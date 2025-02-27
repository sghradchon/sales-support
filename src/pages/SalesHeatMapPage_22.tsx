import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Button,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useDisclosure,
  Input,
} from '@chakra-ui/react';

/** --- 定数・型定義 --- */
const BOX_TOP_PADDING = 40;
const CONTACT_BOX_HEIGHT = 20;
const CONTACT_BOX_GAP = 5;

/** 組織 */
interface Organization {
  organizationId: string;
  organizationName: string;
  upperLevelOrgId: string;
  siblingLevelOrgOrder: number;
  memo: string;
}
/** Contact */
interface Contact {
  contactId: string;
  lastName: string;
  firstName: string;
  organizationId: string;
  title: string;
  contactLevel: number;
  contactDescription: string;
}
/** ツリー */
interface OrgTreeNode {
  org: Organization;
  children: OrgTreeNode[];
  contacts: Contact[];
}
/** レイアウト済みノード */
interface PositionedNode {
  org: Organization;
  x: number; 
  y: number;
  width: number;
  height: number;
  contacts: Contact[];
  children: PositionedNode[];
  subtreeMinY: number;
  subtreeMaxY: number;
  fillColor: string;
}

/** スロット (再配置 or 親変更用) */
interface PositionedSlot {
  x: number;
  y: number;
  width: number;
  height: number;

  slotType: 'reorder' | 'parent'; 
  parentOrgId: string;  
  insertIndex: number; // reorder用 (0～N)
}

/** ドラッグ */
type DragEntityType = 'contact' | 'org';
type DragCandidate = { entityType: DragEntityType; entityId: string; startX: number; startY: number; };
type DraggingState = { entityType: DragEntityType; entityId: string; } | null;

/** モーダル対象 */
type SelectedEntity = { type: 'org'; orgId: string } | { type: 'contact'; contactId: string } | null;

const STORAGE_KEY_ORG = 'o1pro_organizations2';
const STORAGE_KEY_CONTACT = 'o1pro_contacts2';


/** -------------------------------------------------------------
 * メインコンポーネント
 ------------------------------------------------------------- */
const SalesHeatMapPage: React.FC = () => {
  const toast = useToast();  

  const [orgData, setOrgData] = useState<Organization[]>([]);
  const [contactData, setContactData] = useState<Contact[]>([]);
  const [positionedRoot, setPositionedRoot] = useState<PositionedNode | null>(null);
  /** すべての挿入スロット */
  const [slots, setSlots] = useState<PositionedSlot[]>([]);

  // Pan/Zoom
  const [translateX, setTranslateX] = useState(50);
  const [translateY, setTranslateY] = useState(50);
  const [scale, setScale] = useState(1);
  const isPanningRef = useRef(false);
  const lastPointerPosRef = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ドラッグ
  const [dragCandidate, setDragCandidate] = useState<DragCandidate | null>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

  // スロット
  const [hoveredSlot, setHoveredSlot] = useState<PositionedSlot | null>(null);

  // モーダル
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);

  // 新規組織
  const [newOrgName, setNewOrgName] = useState('');

  /** 1) データ読み込み */
  useEffect(() => {
    const loadData = async () => {
      try {
        const localOrgs = localStorage.getItem(STORAGE_KEY_ORG);
        const localContacts = localStorage.getItem(STORAGE_KEY_CONTACT);
        if (localOrgs && localContacts) {
          setOrgData(JSON.parse(localOrgs));
          setContactData(JSON.parse(localContacts));
        } else {
          const [orgResp, contactResp] = await Promise.all([
            fetch('/local-database/organizations.json'),
            fetch('/local-database/contacts.json'),
          ]);
          const orgJson = await orgResp.json();
          const contactJson = await contactResp.json();
          setOrgData(orgJson);
          setContactData(contactJson);
          localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(orgJson));
          localStorage.setItem(STORAGE_KEY_CONTACT, JSON.stringify(contactJson));
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, []);

  /** 2) orgData/contactData 変化 -> レイアウト再計算 */
  useEffect(() => {
    if (!orgData.length) return;
    reLayout();
  }, [orgData, contactData]);

  const reLayout = () => {
    const root = buildOrgTree(orgData, contactData);
    const posRoot = layoutOrgTree(root);
    setPositionedRoot(posRoot);

    // 挿入スロット生成
    const allSlots = buildAllSlots(posRoot);
    setSlots(allSlots);
  };

  /** Contact更新 */
  const updateContact = (updated: Contact) => {
    const newContacts = contactData.map((c) =>
      c.contactId === updated.contactId ? updated : c
    );
    setContactData(newContacts);
    localStorage.setItem(STORAGE_KEY_CONTACT, JSON.stringify(newContacts));
    reLayout();
    toast({ title: 'Contact updated', status: 'success', duration: 2000 });
  };

  /** Org更新 */
  const updateOrganization = (updated: Organization) => {
    const newOrgs = orgData.map((o) =>
      o.organizationId === updated.organizationId ? updated : o
    );
    setOrgData(newOrgs);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(newOrgs));
    reLayout();
    toast({ title: 'Organization updated', status: 'success', duration: 2000 });
  };

  /** reset */
  const handleResetData = async () => {
    try {
      const [oResp, cResp] = await Promise.all([
        fetch('/local-database/organizations.json'),
        fetch('/local-database/contacts.json'),
      ]);
      const oJson = await oResp.json();
      const cJson = await cResp.json();
      setOrgData(oJson);
      setContactData(cJson);
      localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(oJson));
      localStorage.setItem(STORAGE_KEY_CONTACT, JSON.stringify(cJson));
      toast({ title: 'Reset done', status: 'info', duration: 2000 });
    } catch (err) {
      console.error(err);
    }
  };

  /** 組織追加 */
  const handleAddOrganization = () => {
    if (!newOrgName.trim()) return;
    const newId = `org_new_${Date.now()}`;
    const newOrg: Organization = {
      organizationId: newId,
      organizationName: newOrgName.trim(),
      upperLevelOrgId: '',
      siblingLevelOrgOrder: 9999,
      memo: '',
    };
    const updated = [...orgData, newOrg];
    setOrgData(updated);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(updated));
    setNewOrgName('');
  };

  /** delete org */
  const handleDeleteOrg = (orgId: string) => {
    const newOrgs = orgData.filter((o) => o.organizationId !== orgId);
    // 子をroot化
    const children = orgData.filter((o) => o.upperLevelOrgId === orgId);
    const updatedChildren = children.map((c) => ({
      ...c,
      upperLevelOrgId: '',
      siblingLevelOrgOrder: 9999,
    }));
    let finalOrgs = newOrgs.map((o) => {
      const child = updatedChildren.find((uc) => uc.organizationId === o.organizationId);
      return child ?? o;
    });
    setOrgData(finalOrgs);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(finalOrgs));
    toast({ title: 'Organization Deleted', status: 'info', duration: 2000 });
  };

  /** 3) pan/zoom + pointer */
  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragCandidate || draggingState) return;
    isPanningRef.current = true;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    document.body.style.userSelect = 'none';
  };
  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPointerPosRef.current.x;
      const dy = e.clientY - lastPointerPosRef.current.y;
      setTranslateX((prev) => prev + dx);
      setTranslateY((prev) => prev + dy);
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    }

    // drag start
    if (dragCandidate && !draggingState) {
      const distX = e.clientX - dragCandidate.startX;
      const distY = e.clientY - dragCandidate.startY;
      const distance = Math.sqrt(distX * distX + distY * distY);
      if (distance > 5) {
        setDraggingState({
          entityType: dragCandidate.entityType,
          entityId: dragCandidate.entityId
        });
      }
    }

    // ドラッグ中 => スロット判定
    if (draggingState && slots.length>0) {
      const { diagramX, diagramY } = screenToDiagramCoord(e.clientX, e.clientY);
      const found = findSlotAt(slots, diagramX, diagramY);
      setHoveredSlot(found || null);
    } else {
      setHoveredSlot(null);
    }

    if (draggingState) {
      setDragX(e.clientX);
      setDragY(e.clientY);
    }
  };
  const onSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isPanningRef.current = false;
    document.body.style.userSelect = 'auto';

    if (draggingState) {
      dropEntity(e.clientX, e.clientY);
      setDraggingState(null);
      setDragCandidate(null);
      setHoveredSlot(null);
      return;
    }

    if (dragCandidate) {
      // small move => click
      if (dragCandidate.entityType === 'contact') {
        const c = contactData.find((x) => x.contactId === dragCandidate.entityId);
        if (c) {
          setSelectedEntity({ type: 'contact', contactId: c.contactId });
          onOpen();
        }
      } else {
        const o = orgData.find((x) => x.organizationId === dragCandidate.entityId);
        if (o) {
          setSelectedEntity({ type: 'org', orgId: o.organizationId });
          onOpen();
        }
      }
      setDragCandidate(null);
    }
  };
  const onSvgPointerLeave = () => {
    isPanningRef.current = false;
    setDraggingState(null);
    setDragCandidate(null);
    setHoveredSlot(null);
    document.body.style.userSelect = 'auto';
  };
  const onSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor=0.1;
    if(e.deltaY<0){
      setScale(prev=> Math.min(prev+zoomFactor,5));
    } else {
      setScale(prev=> Math.max(prev-zoomFactor,0.2));
    }
  };

  /** 4) drop */
  const dropEntity = (screenX: number, screenY: number) => {
    if(!draggingState) return;
    if(!hoveredSlot) return;

    const {entityType, entityId}=draggingState;
    if(entityType==='contact'){
      const c=contactData.find((x)=>x.contactId===entityId);
      if(!c)return;
      if(hoveredSlot.slotType==='parent'){
        // 末尾に入れる
        const siblings=orgData.filter(o=>o.upperLevelOrgId===hoveredSlot.parentOrgId);
        const maxOrder=Math.max(...siblings.map(s=>s.siblingLevelOrgOrder),0);
        const updated: Contact={...c, organizationId:hoveredSlot.parentOrgId};
        updateContact(updated);
      } else {
        // reorder
        // ここでは "contactの並び替え" は単純に "親を hoveredSlot.parentOrgId" に変更する例
        const updated: Contact={...c, organizationId:hoveredSlot.parentOrgId};
        updateContact(updated);
      }
    } else {
      // org
      const org=orgData.find(o=>o.organizationId===entityId);
      if(!org)return;
      if(hoveredSlot.slotType==='parent'){
        // 親変更 => 末尾
        const siblings=orgData.filter(o=>o.upperLevelOrgId===hoveredSlot.parentOrgId);
        const maxOrder=Math.max(...siblings.map(s=>s.siblingLevelOrgOrder),0);
        const updatedOrg={
          ...org,
          upperLevelOrgId:hoveredSlot.parentOrgId,
          siblingLevelOrgOrder:maxOrder+10
        };
        updateOrganization(updatedOrg);
      } else {
        // reorder => hoveredSlot.insertIndex に挿入
        const siblings=orgData.filter(o=>o.upperLevelOrgId===hoveredSlot.parentOrgId);
        const sameParent=(org.upperLevelOrgId===hoveredSlot.parentOrgId);
        if(sameParent){
          // reorder in same parent
          const sorted=[...siblings].sort((a,b)=>a.siblingLevelOrgOrder - b.siblingLevelOrgOrder);
          const filtered=sorted.filter(s=>s.organizationId!==org.organizationId);
          filtered.splice(hoveredSlot.insertIndex,0,org);
          let base=10;
          filtered.forEach(s=>{
            s.siblingLevelOrgOrder=base;
            base+=10;
          });
          const updatedMe= filtered.find(s=>s.organizationId===org.organizationId);
          if(updatedMe){
            updateOrganization({...updatedMe});
          }
        } else {
          // 親が変わる
          const sorted=[...siblings].sort((a,b)=>a.siblingLevelOrgOrder - b.siblingLevelOrgOrder);
          // insert
          const newOrgData={...org, upperLevelOrgId:hoveredSlot.parentOrgId };
          sorted.splice(hoveredSlot.insertIndex,0,newOrgData as any);
          let base=10;
          sorted.forEach(o2=>{
            o2.siblingLevelOrgOrder=base;
            base+=10;
          });
          const updatedMe=sorted.find(o2=>o2.organizationId===org.organizationId);
          if(updatedMe){
            updateOrganization({...updatedMe});
          }
        }
      }
    }
  };

  /** 5) スロット生成 (挿入スロット) */
  function buildAllSlots(root: PositionedNode): PositionedSlot[] {
    const result: PositionedSlot[]=[];

    function traverse(node: PositionedNode){
      // 1) parentスロット(右端)
      result.push({
        x: node.x+node.width,
        y: node.y,
        width:20,
        height:node.height,
        slotType:'parent',
        parentOrgId:node.org.organizationId,
        insertIndex:0
      });

      // 2) reorderスロット(子の並びに対してN+1個)
      const childSorted=[...node.children].sort((a,b)=>a.y-b.y);
      for(let i=0;i<=childSorted.length;i++){
        let slotY=0;
        if(i===0){
          slotY=node.y; 
        } else {
          const prev=childSorted[i-1];
          slotY= prev.y + prev.height;
        }
        result.push({
          x: node.x,
          y: slotY,
          width: node.width,
          height: 8, 
          slotType:'reorder',
          parentOrgId: node.org.organizationId,
          insertIndex:i
        });
      }

      node.children.forEach(traverse);
    }
    traverse(root);
    return result;
  }

  /** カーソルが乗っているスロットを探す */
  function findSlotAt(slots: PositionedSlot[], x:number, y:number): PositionedSlot|null {
    for(const s of slots){
      if(
        x>=s.x && x<=s.x+s.width &&
        y>=s.y && y<=s.y+s.height
      ){
        return s;
      }
    }
    return null;
  }

  /** 座標変換 */
  function screenToDiagramCoord(clientX:number, clientY:number){
    if(!svgRef.current) return {diagramX:0,diagramY:0};
    const rect= svgRef.current.getBoundingClientRect();
    const sx= clientX-rect.left;
    const sy= clientY-rect.top;
    return {
      diagramX: (sx-translateX)/scale,
      diagramY: (sy-translateY)/scale
    };
  }

  /** 6) ツリー描画 */
  function renderTree(node: PositionedNode): JSX.Element {
    // ノード(組織box) + 子
    return (
      <React.Fragment key={node.org.organizationId}>
        {renderOrgBox(node)}
        {node.children.map(ch=>renderTree(ch))}
      </React.Fragment>
    );
  }

  function renderOrgBox(node: PositionedNode) {
    return (
      <g transform={`translate(${node.x},${node.y})`}>
        <rect
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          fill={node.fillColor}
          stroke="#333"
          strokeWidth={1.5}
          rx={6}
          ry={6}
          style={{cursor:'pointer'}}
          onClick={(e)=>{
            e.stopPropagation();
            setSelectedEntity({ type:'org', orgId:node.org.organizationId });
            onOpen();
          }}
        />
        <text x={10} y={20} fontSize={14} fill="#000">
          {node.org.organizationName} (order={node.org.siblingLevelOrgOrder})
        </text>

        {/* ドラッグハンドル */}
        <rect
          x={node.width-30}
          y={5}
          width={25}
          height={25}
          fill="#999"
          style={{cursor:'grab'}}
          onPointerDown={(e)=>{
            e.stopPropagation();
            setDragCandidate({
              entityType:'org',
              entityId:node.org.organizationId,
              startX:e.clientX,
              startY:e.clientY
            });
            document.body.style.userSelect='none';
          }}
        />
        <text x={node.width-25} y={23} fill="#000" fontSize={12}>≡</text>

        {/* Contacts */}
        {node.contacts.map((c, i)=>{
          const cy= BOX_TOP_PADDING + i*(CONTACT_BOX_HEIGHT+CONTACT_BOX_GAP);
          return (
            <g
              key={c.contactId}
              transform={`translate(10, ${cy})`}
              style={{cursor:'grab'}}
              onPointerDown={(ev)=>{
                ev.stopPropagation();
                setDragCandidate({
                  entityType:'contact',
                  entityId:c.contactId,
                  startX:ev.clientX,
                  startY:ev.clientY
                });
                document.body.style.userSelect='none';
              }}
            >
              <rect
                width={node.width-20}
                height={CONTACT_BOX_HEIGHT}
                fill="#ddd"
                stroke="#000"
              />
              <text x={5} y={15} fill="#000" fontSize={12}>
                {truncateContactLabel(c)}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  /** 7) ドラッグゴースト */
  const renderDragGhost=()=>{
    if(!draggingState) return null;
    const {entityType, entityId}=draggingState;
    const style: React.CSSProperties={
      position:'fixed',
      left: dragX,
      top: dragY,
      width:'100px',
      height:'20px',
      backgroundColor:'rgba(200,200,200,0.8)',
      border:'1px solid #666',
      pointerEvents:'none',
      zIndex:9999,
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
    };
    if(entityType==='contact'){
      const c=contactData.find(x=>x.contactId===entityId);
      if(!c)return null;
      return <div style={style}>{c.lastName}</div>;
    } else {
      const o=orgData.find(o=>o.organizationId===entityId);
      if(!o)return null;
      return <div style={style}>{o.organizationName}</div>;
    }
  };

  /** 8) モーダル */
  const renderModalContent=()=>{
    if(!selectedEntity)return null;
    if(selectedEntity.type==='org'){
      const org=orgData.find(o=>o.organizationId===selectedEntity.orgId);
      if(!org)return <Box>Not found org</Box>;
      return (
        <>
          <ModalHeader>組織情報</ModalHeader>
          <ModalCloseButton/>
          <ModalBody>
            <Box>ID: {org.organizationId}</Box>
            <Box>Name: {org.organizationName}</Box>
            <Box>Parent: {org.upperLevelOrgId}</Box>
            <Box>Order: {org.siblingLevelOrgOrder}</Box>
            <Box>memo: {org.memo}</Box>
            <Box mt={4}>
              <Button colorScheme="red" onClick={()=>{
                onClose();
                handleDeleteOrg(org.organizationId);
              }}>
                削除
              </Button>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>閉じる</Button>
          </ModalFooter>
        </>
      );
    } else {
      const c= contactData.find(x=>x.contactId===selectedEntity.contactId);
      if(!c)return <Box>Not found contact</Box>;
      return (
        <>
          <ModalHeader>Contact情報</ModalHeader>
          <ModalCloseButton/>
          <ModalBody>
            <Box>{c.lastName} {c.firstName} ({c.title})</Box>
            <Box>desc: {c.contactDescription}</Box>
            <Box>Level: {c.contactLevel}</Box>
            <NumberInput
              value={c.contactLevel}
              min={0}
              max={5}
              onChange={(_,val)=>{
                if(val>=0&&val<=5){
                  updateContact({...c, contactLevel:val});
                }
              }}
            >
              <NumberInputField/>
              <NumberInputStepper>
                <NumberIncrementStepper/>
                <NumberDecrementStepper/>
              </NumberInputStepper>
            </NumberInput>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>閉じる</Button>
          </ModalFooter>
        </>
      );
    }
  };

  /** レンダリング */
  const svgWidth=1200;
  const svgHeight=800;

  return (
    <Box p={4}>
      <Box as="h1" fontSize="xl" mb={4}>Sales HeatMap (Slot-based Insert)</Box>

      <Box mb={2}>
        <Button colorScheme="blue" onClick={handleResetData} mr={4}>
          リセット
        </Button>
        <Input
          placeholder="組織名"
          value={newOrgName}
          onChange={(e)=>setNewOrgName(e.target.value)}
          width="200px"
          mr={2}
        />
        <Button onClick={handleAddOrganization}>組織追加</Button>
      </Box>

      <Box
        border="1px solid #ccc"
        position="relative"
        w={`${svgWidth}px`}
        h={`${svgHeight}px`}
      >
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          style={{ background:'#fafafa' }}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerLeave={onSvgPointerLeave}
          onWheel={onSvgWheel}
        >
          <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
            {positionedRoot && renderTree(positionedRoot)}

            {/* hoveredSlotのハイライト */}
            {hoveredSlot && (
              <rect
                x={hoveredSlot.x}
                y={hoveredSlot.y}
                width={hoveredSlot.width}
                height={hoveredSlot.height}
                fill={
                  hoveredSlot.slotType==='parent'
                    ? 'rgba(0,255,0,0.3)'
                    : 'rgba(0,0,255,0.3)'
                }
                pointerEvents="none"
              />
            )}
          </g>
        </svg>
        {renderDragGhost()}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay/>
        <ModalContent>
          {renderModalContent()}
        </ModalContent>
      </Modal>
    </Box>
  );
};

/** 
 * buildOrgTree, layoutOrgTree など。 
 * (ほぼ先ほどのまま)
 */
function buildOrgTree(orgs: Organization[], contacts: Contact[]): OrgTreeNode {
  const sorted=[...orgs].sort((a,b)=>a.siblingLevelOrgOrder-b.siblingLevelOrgOrder);
  const orgMap: Record<string,OrgTreeNode>={};
  sorted.forEach(o=>{
    orgMap[o.organizationId]={org:o,children:[],contacts:[]};
  });
  sorted.forEach(o=>{
    if(o.upperLevelOrgId && orgMap[o.upperLevelOrgId]){
      orgMap[o.upperLevelOrgId].children.push(orgMap[o.organizationId]);
    }
  });
  let root: OrgTreeNode|undefined;
  for(const o of sorted){
    if(!o.upperLevelOrgId||!orgMap[o.upperLevelOrgId]){
      root=orgMap[o.organizationId];
      break;
    }
  }
  contacts.forEach(c=>{
    if(orgMap[c.organizationId]){
      orgMap[c.organizationId].contacts.push(c);
    }
  });
  if(!root){
    root=orgMap[sorted[0].organizationId];
  }
  return root;
}

function layoutOrgTree(root: OrgTreeNode): PositionedNode {
  const horizontalGap=180;
  const verticalGap=40;
  function computePos(node: OrgTreeNode, startX:number, startY:number): PositionedNode {
    const isLeaf=node.children.length===0;
    const boxWidth= isLeaf? (node.contacts.length*80 +60) :150;
    let myHeight=0;
    if(isLeaf){
      myHeight=BOX_TOP_PADDING+20;
    } else {
      const cCount=node.contacts.length;
      const contactArea= cCount*CONTACT_BOX_HEIGHT
        +(cCount>0?(cCount-1)*CONTACT_BOX_GAP:0);
      myHeight=BOX_TOP_PADDING+contactArea;
    }
    let childY=startY;
    const children: PositionedNode[]=[];
    node.children.forEach(ch=>{
      const pos=computePos(ch, startX+horizontalGap, childY);
      children.push(pos);
      childY= pos.subtreeMaxY + verticalGap;
    });
    let subtreeMinY=startY;
    let subtreeMaxY=startY+myHeight;
    if(children.length>0){
      subtreeMaxY=Math.max(subtreeMaxY,children[children.length-1].subtreeMaxY);
    }
    return {
      org:node.org,
      x:startX,
      y:startY,
      width:boxWidth,
      height:myHeight,
      contacts: node.contacts,
      children,
      subtreeMinY:startY,
      subtreeMaxY,
      fillColor:getColorByLevelAvg(node.contacts),
    };
  }
  return computePos(root,0,0);
}

/** スロットを構築 */
function buildAllSlots(root: PositionedNode): PositionedSlot[] {
  const result: PositionedSlot[]=[];

  function traverse(node: PositionedNode){
    // parent slot => 右端 (slotType='parent')
    result.push({
      x: node.x + node.width,
      y: node.y,
      width: 20,
      height: node.height,
      slotType:'parent',
      parentOrgId: node.org.organizationId,
      insertIndex:0
    });

    // reorder slots => node.childrenを y順で sort
    const childSorted=[...node.children].sort((a,b)=>a.y-b.y);
    for(let i=0;i<=childSorted.length;i++){
      let slotY=0;
      if(i===0){
        slotY=node.y;
      } else {
        const prev= childSorted[i-1];
        slotY= prev.y + prev.height;
      }
      result.push({
        x: node.x,
        y: slotY,
        width: node.width,
        height: 10, 
        slotType:'reorder',
        parentOrgId:node.org.organizationId,
        insertIndex:i
      });
    }

    node.children.forEach(traverse);
  }
  traverse(root);
  return result;
}

/** カーソルがどのスロットにいるか? */
function findSlotAt(slots: PositionedSlot[], x:number, y:number): PositionedSlot|null {
  for(const s of slots){
    if(x>=s.x && x<=s.x+s.width && y>=s.y && y<=s.y+s.height){
      return s;
    }
  }
  return null;
}

/** カラー */
function getColorByLevelAvg(contacts: Contact[]){
  if(!contacts.length)return '#fff';
  const sum=contacts.reduce((acc,c)=>acc+c.contactLevel,0);
  const avg=Math.floor(sum/contacts.length);
  return getColorByLevel(avg);
}
function getColorByLevel(level:number){
  switch(level){
    case 0:return '#fff';
    case 1:return '#cce0ff';
    case 2:return '#99c2ff';
    case 3:return '#66a3ff';
    case 4:return '#3385ff';
    case 5:return '#0033ff';
    default:return '#fff';
  }
}
function truncateContactLabel(c: Contact){
  const full=`${c.lastName} ${c.firstName}`;
  if(full.length>15){
    return full.slice(0,14)+'…';
  }
  return full;
}

/** 座標変換 */
function screenToDiagramCoord(clientX: number, clientY: number): { diagramX: number; diagramY: number} {
  // この例では固定値にしている(translateX=50, scale=1など)
  // ちゃんと dynamicにするには state or ref を参照したり引数に渡したりする
  const svgElem=document.querySelector('svg');
  if(!svgElem)return {diagramX:0,diagramY:0};
  const rect= svgElem.getBoundingClientRect();
  const sx= clientX-rect.left;
  const sy= clientY-rect.top;

  // 例: translateX=50, translateY=50, scale=1
  const translateX=50; 
  const translateY=50;
  const scale=1;

  const diagramX=(sx-translateX)/scale;
  const diagramY=(sy-translateY)/scale;
  return { diagramX, diagramY };
}

export default SalesHeatMapPage;