import React, { useEffect, useState, useRef,Dispatch, SetStateAction } from 'react';
// import type { Schema } from "../../amplify/data/resource";
// import { generateClient } from "aws-amplify/data";

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
  useDisclosure,
  Input,
} from '@chakra-ui/react';
import { v4 as uuidv4 } from 'uuid';

import ContactPage from "./ContactPage";

import { Company,Organization, Contact,Opportunity, Activity} from "./TypesAndUtils"
import { PositionedNode,DragOverMode,DragCandidate,DraggingState,SelectedEntity } from './TypesAndUtils';
import { buildOrgTree,layoutOrgTree,findOrgNodeAt,findPositionedNode,createStepPath,measureTextWidth,truncateContactLabel,layoutNewNodes,isDescendant } from './TypesAndUtils';
import { GripVertical } from 'lucide-react';

// const client = generateClient<Schema>();

const BOX_TOP_PADDING = 40;
const CONTACT_BOX_HEIGHT = 20;
const CONTACT_BOX_GAP = 5;


const svgWidth = 1200;
const svgHeight = 300;

interface CompanyProps {
  company:Company;  
  orgData: Organization[];
  contactData: Contact[];
  opportunityData:Opportunity[];
  activityData:Activity[];
  setOrgData: (
    updated: Organization[] | ((prev: Organization[]) => Organization[])
  ) => void;
  setContactData:(
    updated: Contact[] | ((prev: Contact[]) => Contact[])
  ) => void;
  setOpportunityData:Dispatch<SetStateAction<Opportunity[]>>;
  setActivityData:Dispatch<SetStateAction<Activity[]>>;
}

const CompanyComponent: React.FC<CompanyProps> = (props) => {
  const {
    company,
    orgData, contactData,opportunityData,activityData,
    setOrgData,setContactData,setOpportunityData,setActivityData,
  } = props;

  const toast = useToast();
  

  const [positionedRoot, setPositionedRoot] = useState<PositionedNode | null>(null);
  const [positionedNewNodes, setPositionedNewNodes] = useState<PositionedNode[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const isPanningRef = useRef(false);
  // ドラッグ
  const [dragCandidate, setDragCandidate] = useState<DragCandidate | null>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

  // ハイライト
  const [dragOverOrgId, setDragOverOrgId] = useState<string | null>(null);
  const [dragOverMode, setDragOverMode] = useState<DragOverMode>(null);

    // Pan/Zoom
  const [translateX, setTranslateX] = useState(50);
  const [translateY, setTranslateY] = useState(50);
  const [scale, setScale] = useState(1);
  
  const lastPointerPosRef = useRef({ x: 0, y: 0 });
  
  //modal
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  

  //new
  const [newOrgName, setNewOrgName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactFirstName, setNewContactFirstName] = useState('');
  

  useEffect(()=>{
    if(orgData&&orgData.length>0){
      reLayout();
    }
  }, [orgData, contactData]);


  function reLayout() {
    // (A) 従来の orgTree を構築(“NEW” を除外) + レイアウト
    const mainOrgs = orgData.filter(o => o.upperLevelOrgId !== 'NEW');
    const root = buildOrgTree(mainOrgs, contactData);
    const posRoot = layoutOrgTree(root);
    setPositionedRoot(posRoot);
    const newOrgs = orgData.filter(o => o.upperLevelOrgId === 'NEW');
    const newPos = layoutNewNodes(newOrgs);
    setPositionedNewNodes(newPos);
  }


  const updateContact = (updated: Contact) => {
      setContactData((prev: Contact[]) => 
        prev.map(c => 
          c.id === updated.id ? updated : c
        )
      );
      toast({ title:'Updated locally (not saved)', status:'info' });
    };
  
    function updateOrganization(updated: Organization) {
      setOrgData((prev:Organization[]) => 
        prev.map(o => 
          o.id === updated.id ? updated : o
        )
      );
  
      toast({ title:'Updated locally (not saved)', status:'info' });
    }


  const handleAddOrganization = async () => {
    if (!newOrgName.trim()) return;
  
    // 1) まず root候補を探す
    const sorted = [...orgData].sort((a,b)=> a.siblingLevelOrgOrder - b.siblingLevelOrgOrder);
    const rootOrg = sorted.find(o => o.upperLevelOrgId == '');
    
    let upperLevelOrgId = "NEW"
    if (!rootOrg) {
      toast({
        title: 'No existing root found.',
        status: 'error',
        duration: 2000,
      });
      // return;
      upperLevelOrgId = ""

    }
  
    // 2) 新しい組織
    const newId = `ORG_${uuidv4()}`;
    const newOrg: Organization = {
      id: newId,
      organizationName: newOrgName.trim(),
      upperLevelOrgId: upperLevelOrgId,
      siblingLevelOrgOrder: 9999,
      companyId:company.id,
      memo: ''
    };
  
    setOrgData([...orgData, newOrg]);
    console.log("orgData",newOrg)
    setNewOrgName('');
    // toast
    toast({ title: 'Added locally (not saved yet)', status: 'info' });
  }

  function handleDeleteOrg(orgId: string) {
    // ローカル state から削除
    let newOrgs = orgData.filter((o) => o.id !== orgId);
  
    // 子組織 root化などのロジック
    const children = orgData.filter((o) => o.upperLevelOrgId === orgId);
    const updatedChildren = children.map((c) => ({
      ...c,
      upperLevelOrgId: '',
      siblingLevelOrgOrder: 9999,
    }));
    newOrgs = newOrgs.map((o) => {
      const child = updatedChildren.find((uc) => uc.id === o.id);
      return child ?? o;
    });
  
    setOrgData(newOrgs);
    toast({ title:'Deleted locally (not saved)', status:'info' });
  }

  function getRootOrgId(orgData: Organization[]): Organization | null {
    // upperLevelOrgId === '' のものを探し、先頭を root とする
    const rootOrg = orgData.find(o => o.upperLevelOrgId === '');
    return rootOrg ? rootOrg : null;
  }

  const handleAddContactRoot = async () => {
    if (!newContactLastName.trim()) return;
    if (!newContactFirstName.trim()) return;

    const rootOrg = getRootOrgId(orgData);

    if (!rootOrg) {
      toast({
        title: 'No existing root found.',
        status: 'error',
        duration: 2000,
      });
      return;
    }
  
    // 2) 新しい組織
    const newId = `CONTACT_${uuidv4()}`;
  // 3) 追加する
    const newContact: Contact = {
      id: newId,
      lastName: newContactLastName.trim(),
      firstName: newContactFirstName.trim(),
      belongingOrgId: rootOrg.id, // rootに所属
      belongingCompanyId:company.id,
      title: '',
      contactLevel: 0,
      contactDescription: '',
      keyPerson:false
    };
  
    setContactData([...contactData, newContact]);
    setNewContactLastName('');
    setNewContactFirstName('');

    // toast
    toast({ title: 'Contact added locally (root)', status: 'info' });
  }

  const handleAddContactOrg = async (org:Organization) => {
    if (!newContactLastName.trim()) return;
    if (!newContactFirstName.trim()) return;
    
    // 2) 新しい組織
    const newId = `CONTACT_${uuidv4()}`;
  // 3) 追加する
    const newContact: Contact = {
      id: newId,
      lastName: newContactLastName.trim(),
      firstName: newContactFirstName.trim(),
      belongingOrgId: org.id, 
      belongingCompanyId:company.id,
      title: '',
      contactLevel: 0,
      contactDescription: '',
      keyPerson:false
    };
  
    setContactData((prev) => {
      return [...prev, newContact]; 
    });
    setNewContactLastName('');
    setNewContactFirstName('');

    // toast
    toast({ title: `Contact added locally (${org.organizationName})`, status: 'info' });
  }

  
  // function handleDeleteContact(contactId: string) {
  //   setContactData((prev)=> prev.filter((c)=> c.id !== contactId));
  //   toast({ title:'Contact deleted locally', status:'info'})
  // }


  const handleAddActivity = (newActivity:Activity) => {
    setActivityData(prev => [...prev, newActivity]);
    // 必要に応じて再レイアウトなどを実施
  };

  // function deleteActivity(activityId: string) {
  //   setActivityData(prev =>
  //     prev.filter(a => a.id !== activityId)
  //   );
  //   toast({ title:'Deleted Activity locally', status:'info'});
  // }
  
  const handleAddOpportunity = (newOpportunity:Opportunity) => {
    setOpportunityData(prev => [...prev, newOpportunity]);
    // 必要に応じて再レイアウトなどを実施
  };

  

    const dropEntity = (screenX: number, screenY: number) => {
      if (!draggingState || !positionedRoot) return;
      const { entityType, entityId } = draggingState;
      const { diagramX, diagramY } = screenToDiagramCoord(screenX, screenY);
  
      const overOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
      if (!overOrgId) return;
  
      if (entityType === 'contact') {
        // Contact => Org (シンプル)
        const c = contactData.find((x) => x.id === entityId);
        if (!c) return;
        const updated: Contact = { ...c, belongingOrgId: overOrgId };
        updateContact(updated);
  
      } else {
        // Org => Org
        const org = orgData.find((o) => o.id === entityId);
        if (!org) return;
        if (org.id === overOrgId) return;
  
        const dropTarget = orgData.find((o) => o.id === overOrgId);
        if (!dropTarget) {
          // root化 (親= '')
          const updatedOrg: Organization = {
            ...org,
            upperLevelOrgId: '',
            siblingLevelOrgOrder: 9999,
            memo: org.memo,
  
          };
          updateOrganization(updatedOrg);
          return;
        }
  
        // dragOverMode -> parent/before/after
        if (!dragOverMode) return; // null safety
        if (isDescendant(positionedRoot, org.id, overOrgId)) {
          toast({
            title: 'Invalid drop',
            description: 'Cannot place an ancestor under its own descendant!',
            status: 'error',
            duration: 3000,
          });
          return;
        }
        dropEntityForOrg(org, dropTarget, dragOverMode);
      }
    };
  
    /** ★★★ ここが「親変更 + 並び順指定」を同時に実行する関数 ★★★ */
    function dropEntityForOrg(
      org: Organization,
      dropTarget: Organization,
      mode: 'parent'|'before'|'after'
    ) {
      // 「orgがleafかどうか」判定
      const orgIsLeaf = !orgData.some(child => child.upperLevelOrgId === org.id);
      // 「dropTargetに子がいるかどうか」判定
      const targetHasChildren = orgData.some(child => child.upperLevelOrgId === dropTarget.id);
    
      if (mode === 'parent') {
        // もし "dropTargetに子がいる + orgはleaf" => insertBetween
        if (targetHasChildren && orgIsLeaf) {
          insertBetweenLogic(org, dropTarget);
        } else {
          // 通常の親変更
          normalParentLogic(org, dropTarget);
        }
        return;
      }
      else if (mode === 'before') {
        insertBeforeLogic(org, dropTarget);
        return;
      }
      else if (mode === 'after') {
        insertAfterLogic(org, dropTarget);
        return;
      }
    }
    
    /** 【A】"親変更" 通常ロジック */
    function normalParentLogic(org: Organization, dropTarget: Organization) {
      // 1) org の 新たな親 = dropTarget
      const newParentId = dropTarget.id;
      
      org = { ...org, upperLevelOrgId: newParentId };
      
      // 2) siblingsを取得 (同じ親で upperLevelOrgId===newParentId )
      const siblings = orgData.filter(o => o.upperLevelOrgId === newParentId);
    
      // 3) 末尾にしたいなら「既存の siblings の maxOrder + 10」
      // (兄弟のオーダーは保ったまま)
      const maxOrder = siblings.reduce((acc, s) => Math.max(acc, s.siblingLevelOrgOrder), 0);
      org.siblingLevelOrgOrder = maxOrder + 10;
    
      // 4) update local
      updateOrganization(org); 
      toast({ title: 'Set new parent (normal)', status: 'info' });
    }
    
    /** 【B】挟むロジック: dropTargetに子がある & orgがleaf */
    function insertBetweenLogic(org: Organization, dropTarget: Organization) {
      // 1) dropTargetの旧 親
      const oldParentId = dropTarget.id;
      
      // 2) leaf(org) を dropTarget.oldParent の子にする
      org.upperLevelOrgId = oldParentId || '';
    
      // 3) dropTarget (＆必要なら その兄弟)を org の子にする
      //   ここでは “ドロップ先 + その兄弟” すべてをまとめて移す例
      const siblings = orgData.filter(o => o.upperLevelOrgId === oldParentId);
      
      for (const sib of siblings) {
        if (sib.id === org.id) continue; // 自分自身を子にしない
        // 兄弟の siblingLevelOrgOrder はそのまま(再割当しない)
        sib.upperLevelOrgId = org.id;
      }
    
      updateOrganization({ ...org });
      // siblings も setOrgData で一括書き換えるか、個別に updateOrganization() するかはお好み
      setOrgData(prev =>
        prev.map(o => {
          if (o.id === org.id) {
            return { ...org };
          }
          if (siblings.some(s=> s.id===o.id)) {
            const s2 = siblings.find(x=> x.id===o.id)!;
            return { ...s2 };
          }
          return o;
        })
      );
    
      toast({ title: 'Inserted Between!', status: 'info' });
    }
    
    /** 【C】insertBeforeLogic: dropTargetの手前に挿入する */
    function insertBeforeLogic(org: Organization, dropTarget: Organization) {
      // 1) 新しい親 = dropTarget の親
      const newParentId = dropTarget.upperLevelOrgId || '';
      org = { ...org, upperLevelOrgId: newParentId };
    
      // 2) "org" の siblingLevelOrgOrder を dropTarget より少し小さくする
      //    => 兄弟のオーダーはそのまま維持
      //    => 例: dropTarget.siblingLevelOrgOrder - 0.1
      const newOrder = dropTarget.siblingLevelOrgOrder - 1;
      org.siblingLevelOrgOrder = newOrder;
    
      // 3) update
      updateOrganization(org);
      setOrgData(prev =>
        prev.map(o => (o.id===org.id)? {...org} : o)
      );
    
      toast({ title: 'Insert Before done', status: 'info' });
    }
    
    /** 【D】insertAfterLogic: dropTargetの後ろに挿入する */
    function insertAfterLogic(org: Organization, dropTarget: Organization) {
      // 1) 新しい親 = dropTarget の親
      const newParentId = dropTarget.upperLevelOrgId || '';
      org = { ...org, upperLevelOrgId: newParentId };
    
      // 2) org の siblingLevelOrgOrder = dropTarget.siblingLevelOrgOrder + 0.1
      //   => keep existing sibling orders
      const newOrder = dropTarget.siblingLevelOrgOrder + 1;
      org.siblingLevelOrgOrder = newOrder;
    
      // 3) update
      updateOrganization(org);
      setOrgData(prev =>
        prev.map(o => (o.id===org.id)? {...org} : o)
      );
    
      toast({ title: 'Insert After done', status: 'info' });
    }

  function screenToDiagramCoord(clientX: number, clientY: number) {
    if (!svgRef.current) return { diagramX: 0, diagramY: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      diagramX: (sx - translateX) / scale,
      diagramY: (sy - translateY) / scale
    };
  }


  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragCandidate || draggingState) return;
      isPanningRef.current = true;
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
      document.body.style.userSelect = 'none';
    };
  

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
      if (isPanningRef.current) {
        return;//pan無効
      }
  
      // ドラッグ開始
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
  
      // ハイライト計算 (orgドラッグ中)
      if (draggingState?.entityType === 'org' && positionedRoot) {
        const { diagramX, diagramY } = screenToDiagramCoord(e.clientX, e.clientY);
        const overOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
        if (overOrgId && overOrgId !== draggingState.entityId) {
          // ★ 自分自身を除外
          setDragOverOrgId(overOrgId);
  
          const node = findPositionedNode(positionedRoot, overOrgId);
          if (node) {
            // 右端判定
            const thresholdX = node.x + node.width * 0.75;
            if (diagramX > thresholdX) {
              setDragOverMode('parent');
            } else {
              // 上 or 下
              const centerY = node.y + node.height / 2;
              if (diagramY < centerY) {
                setDragOverMode('before');
              } else {
                setDragOverMode('after');
              }
            }
          } else {
            setDragOverMode(null);
          }
        } else {
          // 領域外 or 自分自身
          setDragOverOrgId(null);
          setDragOverMode(null);
        }
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
        // ハイライト消去
        setDragOverOrgId(null);
        setDragOverMode(null);
        return;
      }
  
      // クリック
      if (dragCandidate) {
        if (dragCandidate.entityType === 'contact') {
          const c = contactData.find((x) => x.id === dragCandidate.entityId);
          if (c) {
            setSelectedEntity({ type: 'contact', id: c.id });
            onOpen();
          }
        } else {
          const o = orgData.find((x) => x.id === dragCandidate.entityId);
          if (o) {
            setSelectedEntity({ type: 'org', id: o.id });
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
      // ハイライト消去
      setDragOverOrgId(null);
      setDragOverMode(null);
      document.body.style.userSelect = 'auto';
    };
  
  
    const MIN_SCALE = 0.2;
    const MAX_SCALE = 5.0;  
  
     // 拡大ボタン
     const handleZoomIn = () => {
      setScale((prev) => Math.min(prev * 1.2, MAX_SCALE));
    };
    // 縮小ボタン
    const handleZoomOut = () => {
      setScale((prev) => Math.max(prev / 1.2, MIN_SCALE));
    };


      //
      // 6) ツリー構築 + レイアウト
      //
    
      function renderTree(node: PositionedNode, parent?: PositionedNode) {
        let connectionPath: string | undefined;
        if (parent) {
          const startX = parent.x + parent.width;
          const startY = parent.y + 20;
          const endX = node.x;
          const endY = node.y + 20;
          connectionPath = createStepPath(startX, startY, endX, endY);
        }
    
        return (
          <React.Fragment key={node.org.id}>
            {connectionPath && (
              <path d={connectionPath} stroke="#666" fill="none" strokeWidth={2} />
            )}
            {renderOrgBox(node)}
            {node.children.map((child) => renderTree(child, node))}
          </React.Fragment>
        );
      }
    
    
      function renderNewNodes(nodes: PositionedNode[]) {
        return (
          <>
            {nodes.map((pNode) => {
              return (
                <g key={pNode.org.id} transform={`translate(${pNode.x}, ${pNode.y})`}>
                  <rect
                    width={pNode.width}
                    height={pNode.height}
                    fill={pNode.fillColor}
                    stroke="#333"
                    strokeWidth={1.5}
                    rx={6}
                    ry={6}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntity({ type: 'org', id:pNode.org.id });
                      onOpen();
                    }}
                  />
                  <text x={10} y={20} fontSize={14} fill="#000">
                    {pNode.org.organizationName} (NEW)
                  </text>
                  
                  {/* ドラッグハンドル */}
                  <rect
                    x={pNode.width - 30}
                    y={5}
                    width={25}
                    height={25}
                    fill="#aaa"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDragCandidate({
                        entityType: 'org',
                        entityId: pNode.org.id,
                        startX: e.clientX,
                        startY: e.clientY
                      });
                      document.body.style.userSelect = 'none';
                    }}
                  />
                  <text x={pNode.width - 25} y={23} fontSize={12} fill="#000">
                    ≡
                  </text>
                </g>
              );
            })}
          </>
        );
      }


      // 8) 組織ボックス
  //
  function renderOrgBox(node: PositionedNode) {
    const onOrgBoxClick = (e: React.MouseEvent<SVGRectElement>) => {
      e.stopPropagation();
      setSelectedEntity({ type: 'org', id:node.org.id });
      onOpen();
    };

    return (
      <g transform={`translate(${node.x}, ${node.y})`}>
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
          style={{ cursor: 'pointer' }}
          onClick={onOrgBoxClick}
        />
        <text x={10} y={20} fontSize={14} fill="#000">
          {node.org.organizationName} 
        </text>

        
          <foreignObject
            x={node.width - 24}
            y={5}
            width={25}
            height={25}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setDragCandidate({
                entityType: 'org',
                entityId: node.org.id,
                startX: e.clientX,
                startY: e.clientY
              });
              document.body.style.userSelect = 'none';
            }}
          >
            <GripVertical size={20} color="#888" style={{ pointerEvents: 'none', width: '100%', height: '100%' }} />

          </foreignObject>

        {/* ハイライト */}
        {dragOverOrgId === node.org.id
          && draggingState?.entityType === 'org'
          && draggingState.entityId !== node.org.id
          && <InsertionIndicator node={node} mode={dragOverMode} />
        }

        {/* contacts */}
        {node.children.length === 0
          ? renderContactsHorizontal(node)
          : renderContactsVertical(node)}
      </g>
    );
  }

  // 9) Contact描画
    //
    function renderContactsVertical(node: PositionedNode) {
      const contactHeight = CONTACT_BOX_HEIGHT;
      const gap = CONTACT_BOX_GAP;
      const paddingX = 10;
    
      let cumulativeY = BOX_TOP_PADDING - 5; // 開始位置調整
    
      return node.contacts.map((contact) => {
        const label = truncateContactLabel(contact);
        const textWidth = measureTextWidth(label);
        const contactWidth = textWidth + paddingX * 2;
    
        const currentY = cumulativeY;
        cumulativeY += contactHeight + gap;
    
        return (
          <g
            key={contact.id}
            transform={`translate(10, ${currentY})`}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setDragCandidate({
                entityType: 'contact',
                entityId: contact.id,
                startX: e.clientX,
                startY: e.clientY
              });
              document.body.style.userSelect = 'none';
            }}
          >
            <rect
              width={contactWidth}
              height={contactHeight}
              fill={contactHasOpportunity(contact.id) ? "#DAFFF1" : "#ffffff"}
              stroke={contact.keyPerson ? "#0ACF83" : "#000"}
              strokeWidth={1}
              rx={8}
              ry={8}
            />
            <text x={paddingX} y={15} fontSize={12} fill="#000">
              {label}
            </text>
            {getActivityCount(contact.id) > 0 && (
              <>
                <circle
                  cx={contactWidth - 2}
                  cy={2}
                  r={7}
                  fill="#fff"
                  stroke="#0ACF83"
                  strokeWidth={1}
                />
                <text
                  x={contactWidth - 4}
                  y={5}
                  fontSize={8}
                  fill="#0ACF83"
                >
                  {getActivityCount(contact.id)}
                </text>
              </>
            )}
          </g>
        );
      });
    }
    
  
    function renderContactsHorizontal(node: PositionedNode) {
      const contactHeight = CONTACT_BOX_HEIGHT;
      const gap = 5;
      const paddingX = 5;
    
      let cumulativeX = 10; // 最初の位置から始める
    
      return node.contacts.map((contact) => {
        const label = truncateContactLabel(contact);
        const textWidth = measureTextWidth(label);
        const contactWidth = textWidth + paddingX * 2;
    
        const currentX = cumulativeX; // 現在のrectのX位置
        cumulativeX += contactWidth + gap; // 次のrect用に累積
    
        const cy = 40 - 5;
    
        return (
          <g
            key={contact.id}
            transform={`translate(${currentX}, ${cy})`}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setDragCandidate({
                entityType: 'contact',
                entityId: contact.id,
                startX: e.clientX,
                startY: e.clientY,
              });
              document.body.style.userSelect = 'none';
            }}
          >
            <rect
              width={contactWidth}
              height={contactHeight}
              fill={contactHasOpportunity(contact.id) ? "#DAFFF1" : "#ffffff"}
              stroke={contact.keyPerson ? "#0ACF83" : "#000"}
              strokeWidth={1}
              rx={8}
              ry={8}
            />
            <text x={paddingX} y={15} fontSize={12} fill="#000">
              {label}
            </text>
            {getActivityCount(contact.id) > 0 && (
              <>
                <circle
                  cx={contactWidth-2}
                  cy={2}
                  r={7}
                  fill="#fff"
                  stroke="#0ACF83"
                  strokeWidth={1}
                />
                <text
                  x={contactWidth-4}
                  y={5}
                  fontSize={8}
                  fill="#0ACF83"
                >
                  {getActivityCount(contact.id)}
                </text>
              </>
            )}
          </g>
        );
      });
    }

        // 指定の contactId に対して、opportunity があるかチェックする
    function contactHasOpportunity(contactId: string): boolean {
      return opportunityData.filter((opp: { contactId: string }) => opp.contactId === contactId).length > 0;
    }

    // 各 contactId に紐づく activities の数を返す関数
    function getActivityCount(contactId: string): number {
      return activityData.filter((act: { contactId: string }) => act.contactId === contactId).length;
    }


    // 10) ハイライト用コンポーネント
      //
    const InsertionIndicator: React.FC<{ node: PositionedNode; mode: DragOverMode }> = ({ node, mode }) => {
      const margin = 6;
      if (!mode) return null;
      
      if (mode === 'parent') {
        // 右端 => x=node.width
        return (
          <line
            x1={node.width+margin}
            y1={0}
            x2={node.width+margin}
            y2={node.height}
            stroke="green"
            strokeWidth={10}
            pointerEvents="none"
          />
        );
      } else if (mode === 'before') {
        // 上辺 => y=0
        return (
          <line
            x1={0}
            y1={0-margin}
            x2={node.width}
            y2={0-margin}
            stroke="green"
            strokeWidth={10}
            pointerEvents="none"
          />
        );
      } else if (mode === 'after') {
        // 下辺 => y=node.height
        return (
          <line
            x1={0}
            y1={node.height+margin}
            x2={node.width}
            y2={node.height+margin}
            stroke="green"
            strokeWidth={10}
            pointerEvents="none"
          />
        );
      }
      return null;
    };


  // 12) ドラッグゴースト(シンプル)
  //
  const renderDragGhost = () => {
    if (!draggingState) return null;
    const { entityType, entityId } = draggingState;

    if (entityType === 'contact') {
      // Contactゴースト
      const c = contactData.find((x) => x.id === entityId);
      if (!c) return null;
      const style: React.CSSProperties = {
        position: 'fixed' as const,
        left: dragX - 10,
        top: dragY - 10,
        width: '80px',
        height: '20px',
        backgroundColor: '#ccc',
        border: '1px solid #333',
        opacity: 0.7,
        pointerEvents: 'none',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#000',
        fontSize: '12px'
      };
      return <div style={style}>{c.lastName}</div>;
    } else {
      // Orgゴースト
      const o = orgData.find((oo) => oo.id === entityId);
      if (!o) return null;
      const style: React.CSSProperties = {
        position: 'fixed' as const,
        left: dragX - 20,
        top: dragY - 10,
        width: '120px',
        height: '30px',
        backgroundColor: '#ddd',
        border: '1px solid #333',
        opacity: 0.8,
        pointerEvents: 'none',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#000',
        fontSize: '12px'
      };
      return <div style={style}>{o.organizationName}</div>;
    }
  };

  const renderModalContent = () => {
      if (!selectedEntity) return null;
  
      if (selectedEntity.type === 'org') {
        const org = orgData.find((o) => o.id === selectedEntity.id);
        if (!org) return <Box>Not found</Box>;
        return (
          <>
            <ModalHeader>組織情報</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Box>ID: {org.id}</Box>
              <Box>Name: {org.organizationName}</Box>
              <Box>Parent: {org.upperLevelOrgId}</Box>
              <Box>Order: {org.siblingLevelOrgOrder}</Box>
              <Box>memo: {org.memo}</Box>
              <Input
                placeholder="姓"
                value={newContactLastName}
                onChange={(e) => setNewContactLastName(e.target.value)}
                width="100px"
                mr={2}
              />
              <Input
                placeholder="名"
                value={newContactFirstName}
                onChange={(e) => setNewContactFirstName(e.target.value)}
                width="100px"
                mr={2}
              />
              <Button onClick={()=>handleAddContactOrg(org)}>人員追加</Button>
              <Box mt={4}>
                <Button
                  colorScheme="red"
                  onClick={() => {
                    onClose();
                    handleDeleteOrg(org.id);
                  }}
                >
                  削除
                </Button>
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button onClick={onClose}>閉じる</Button>
            </ModalFooter>
          </>
        );
      
      } else { const c = contactData.find((x) => x.id === selectedEntity.id);
          if (!c) return <Box>Contactが見つかりません</Box>;
  
          return (
          <ContactPage 
            contact={c} 
            onClose={onClose} 
            onAddActivity={handleAddActivity}
            onAddOpportunity={handleAddOpportunity}
            activities={activityData}           // 追加
            opportunities={opportunityData} 
          />
          );
        }
      };
  
    




    
  


    return (
      <Box p={4}>
        <Box as="h1" fontSize="xl" mb={4}>
                {company.companyName}
              </Box>
        <Button onClick={handleZoomIn} mr={1} w="30px" h="30px" borderRadius="full">＋</Button>
        <Button onClick={handleZoomOut} mr={1} w="30px" h="30px" borderRadius="full">－</Button>
        <Box>
              <Input
                  placeholder="新しい組織名"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  width="200px"
                  mr={2}
                />
                <Button onClick={handleAddOrganization} mr={10}>組織追加</Button>
                <Input
                  placeholder="姓"
                  value={newContactLastName}
                  onChange={(e) => setNewContactLastName(e.target.value)}
                  width="100px"
                  mr={2}
                />
                <Input
                  placeholder="名"
                  value={newContactFirstName}
                  onChange={(e) => setNewContactFirstName(e.target.value)}
                  width="100px"
                  mr={2}
                />
                <Button onClick={handleAddContactRoot}>人員追加</Button>
                
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
            style={{ background: '#fafafa' }}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onPointerLeave={onSvgPointerLeave}
            // onWheel={onSvgWheel}
          >
            <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
              {positionedRoot && renderTree(positionedRoot)}
              {positionedNewNodes && renderNewNodes(positionedNewNodes)}
            </g>
          </svg>
          {renderDragGhost()}
        </Box>
        <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent>
                  {renderModalContent()}
                </ModalContent>
              </Modal>
     </Box>
          
    );
};

export default CompanyComponent;