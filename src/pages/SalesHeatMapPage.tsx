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

const BOX_TOP_PADDING = 40;
const CONTACT_BOX_HEIGHT = 20;
const CONTACT_BOX_GAP = 5;

interface Organization {
  organizationId: string;
  organizationName: string;
  upperLevelOrgId: string;
  siblingLevelOrgOrder: number;
  memo: string;

  /** 新規作成時、レイアウト無視で配置するための手動座標(任意) */
  manualX?: number;
  manualY?: number;
}

interface Contact {
  contactId: string;
  lastName: string;
  firstName: string;
  organizationId: string;
  title: string;
  contactLevel: number;
  contactDescription: string;
}

interface OrgTreeNode {
  org: Organization;
  children: OrgTreeNode[];
  contacts: Contact[];
}

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

type DragEntityType = 'contact' | 'org';
type DragCandidate = {
  entityType: DragEntityType;
  entityId: string;
  startX: number;
  startY: number;
};
type DraggingState = {
  entityType: DragEntityType;
  entityId: string;
} | null;

type SelectedEntity =
  | { type: 'org'; orgId: string }
  | { type: 'contact'; contactId: string }
  | null;

type DragOverMode = 'parent' | 'before' | 'after' | null;

const STORAGE_KEY_ORG = 'o1pro_organizations2';
const STORAGE_KEY_CONTACT = 'o1pro_contacts2';

// ---------------------------
const SalesHeatMapPage: React.FC = () => {
  const toast = useToast();

  const [orgData, setOrgData] = useState<Organization[]>([]);
  const [contactData, setContactData] = useState<Contact[]>([]);
  const [positionedRoot, setPositionedRoot] = useState<PositionedNode | null>(null);

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

  // ハイライト
  const [dragOverOrgId, setDragOverOrgId] = useState<string | null>(null);
  const [dragOverMode, setDragOverMode] = useState<DragOverMode>(null);

  // モーダル
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);

  const [newOrgName, setNewOrgName] = useState('');

  //
  // 1) データ読み込み
  //
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

  //
  // 2) レイアウト再計算
  //
  useEffect(() => {
    if (!orgData.length) return;
    reLayout();
  }, [orgData, contactData]);

  const reLayout = () => {
    const root = buildOrgTree(orgData, contactData);
    const posRoot = layoutOrgTree(root);
    setPositionedRoot(posRoot);
  };

  //
  // Contact更新
  //
  const updateContact = (updated: Contact) => {
    const newContacts = contactData.map((c) =>
      c.contactId === updated.contactId ? updated : c
    );
    setContactData(newContacts);
    localStorage.setItem(STORAGE_KEY_CONTACT, JSON.stringify(newContacts));
    reLayout();
    toast({ title: 'Contact Updated', status: 'success', duration: 2000 });
  };

  //
  // Organization更新
  //
  const updateOrganization = (updated: Organization) => {
    const newOrgs = orgData.map((o) =>
      o.organizationId === updated.organizationId ? updated : o
    );
    setOrgData(newOrgs);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(newOrgs));
    reLayout();
    toast({ title: 'Organization Updated', status: 'success', duration: 2000 });
  };

  //
  // 組織追加・削除・リセット
  //
  const handleAddOrganization = () => {
    if (!newOrgName.trim()) return;
  
    // 1) まず root候補を探す
    const sorted = [...orgData].sort((a,b)=> a.siblingLevelOrgOrder - b.siblingLevelOrgOrder);
    const rootOrg = sorted.find(o => !o.upperLevelOrgId);
  
    if (!rootOrg) {
      toast({
        title: 'No existing root found.',
        status: 'error',
        duration: 2000,
      });
      return;
    }
  
    // 2) 新しい組織
    const newId = `org_new_${Date.now()}`;
    const newOrg: Organization = {
      organizationId: newId,
      organizationName: newOrgName.trim(),
      // 新たに "rootOrg" の子にする
      upperLevelOrgId: rootOrg.organizationId, 
      siblingLevelOrgOrder: 9999, // 一番下に配置
      memo: '',
    };
  
    const updated = [...orgData, newOrg];
    setOrgData(updated);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(updated));
  
    setNewOrgName('');
    toast({ title: 'New org added under root.', status:'success', duration:2000 });
  };

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

  const handleResetData = async () => {
    try {
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

      toast({ title: 'Reset to initial data', status: 'info', duration: 2000 });
    } catch (err) {
      console.error(err);
    }
  };

  //
  // 3) Pan/Zoom + pointer events
  //
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
    // ハイライト消去
    setDragOverOrgId(null);
    setDragOverMode(null);
    document.body.style.userSelect = 'auto';
  };

  const onSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + zoomFactor, 5));
    } else {
      setScale((prev) => Math.max(prev - zoomFactor, 0.2));
    }
  };

  function isDescendant(root: PositionedNode, potentialAncestorId: string, checkId: string): boolean {
    // 1) potentialAncestorId のノードを探す
    const ancestorNode = findPositionedNode(root, potentialAncestorId);
    if (!ancestorNode) return false; // そもそも見つからないなら false
  
    // 2) ancestorNode のサブツリー内に checkId がいるか
    return hasNode(ancestorNode, checkId);
  }
  
  // 再帰的にサブツリー内に orgId が含まれるかをチェック
  function hasNode(node: PositionedNode, targetOrgId: string): boolean {
    if (node.org.organizationId === targetOrgId) return true;
    // 子を再帰
    for (const c of node.children) {
      if (hasNode(c, targetOrgId)) return true;
    }
    return false;
  }
  
  //
  // 4) ドロップ処理
  //
  const dropEntity = (screenX: number, screenY: number) => {
    if (!draggingState || !positionedRoot) return;
    const { entityType, entityId } = draggingState;
    const { diagramX, diagramY } = screenToDiagramCoord(screenX, screenY);

    const overOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
    if (!overOrgId) return;

    if (entityType === 'contact') {
      // Contact => Org (シンプル)
      const c = contactData.find((x) => x.contactId === entityId);
      if (!c) return;
      const updated: Contact = { ...c, organizationId: overOrgId };
      updateContact(updated);

    } else {
      // Org => Org
      const org = orgData.find((o) => o.organizationId === entityId);
      if (!org) return;
      if (org.organizationId === overOrgId) return;

      const dropTarget = orgData.find((o) => o.organizationId === overOrgId);
      if (!dropTarget) {
        // root化 (親= '')
        const updatedOrg: Organization = {
          ...org,
          upperLevelOrgId: '',
          siblingLevelOrgOrder: 9999,
          memo: org.memo,
          manualX: undefined,
          manualY: undefined,
        };
        updateOrganization(updatedOrg);
        return;
      }

      // dragOverMode -> parent/before/after
      if (!dragOverMode) return; // null safety
      if (isDescendant(positionedRoot, org.organizationId, overOrgId)) {
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
  function dropEntityForOrg(org: Organization, dropTarget: Organization, mode: 'parent'|'before'|'after') {
    // oldParent
    const oldParentId = org.upperLevelOrgId || '';
    // newParent
    let newParentId: string;
    
    if (mode==='parent') {
      // dropTarget を新しい親にする
      newParentId = dropTarget.organizationId;
    } else {
      // 'before' or 'after' → dropTargetと同じ親を共有する
      newParentId = dropTarget.upperLevelOrgId || '';
    }
    
    const sameParent = (oldParentId === newParentId);

    // 1) newParentの子を取得
    const siblings = orgData.filter(o => o.upperLevelOrgId===newParentId);
    // 2) sort
    const sorted = [...siblings].sort((a,b)=> a.siblingLevelOrgOrder - b.siblingLevelOrgOrder);
    // 3) parent変わるなら org.upperLevelOrgId = newParentId
    if (!sameParent) {
      org = { ...org, upperLevelOrgId: newParentId };
    } else {
      // same parent → reorder
      // remove org from sorted
      const withoutOrg = sorted.filter(x=> x.organizationId!==org.organizationId);
      sorted.length=0;
      withoutOrg.forEach(x=> sorted.push(x));
    }
    
    if (mode==='parent') {
      // 末尾に挿入
      const maxOrder = sorted.reduce((acc, s)=> Math.max(acc, s.siblingLevelOrgOrder),0);
      org.siblingLevelOrgOrder = maxOrder+10;
      
    } else {
      // 'before' or 'after'
      const targetIndex = sorted.findIndex(x=> x.organizationId===dropTarget.organizationId);
      if(targetIndex<0){
        // fallback => 末尾
        sorted.push(org);
      } else {
        if(mode==='before'){
          sorted.splice(targetIndex,0,org);
        } else {
          sorted.splice(targetIndex+1,0,org);
        }
      }
      // 10刻み割り当て
      let base=10;
      for(const s of sorted){
        s.siblingLevelOrgOrder=base;
        base+=10;
      }
    }

    // manualX, manualY 無効化
    org = { ...org, manualX: undefined, manualY: undefined };

    updateOrganization(org);
  }


  //
  // 5) 座標変換
  //
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

  //
  // 6) ツリー構築 + レイアウト
  //
  function findOrgNodeAt(
    node: PositionedNode,
    x: number, 
    y: number,
    margin = 50
  ): string | null {
    const left   = node.x ;
    const right  = node.x + node.width + margin;
    const top    = node.y - margin;
    const bottom = node.y + node.height + margin;

    if (x >= left && x <= right && y >= top && y <= bottom) {
      return node.org.organizationId;
    }
    for (const child of node.children) {
      const found = findOrgNodeAt(child, x, y, margin);
      if (found) return found;
    }
    return null;
  }

  function findPositionedNode(node: PositionedNode, orgId: string): PositionedNode | null {
    if (node.org.organizationId === orgId) return node;
    for (const c of node.children) {
      const found = findPositionedNode(c, orgId);
      if (found) return found;
    }
    return null;
  }

  function buildOrgTree(orgs: Organization[], contacts: Contact[]): OrgTreeNode {
    const sorted = [...orgs].sort(
      (a, b) => a.siblingLevelOrgOrder - b.siblingLevelOrgOrder
    );
    const orgMap: Record<string, OrgTreeNode> = {};
    sorted.forEach((o) => {
      orgMap[o.organizationId] = { org: o, children: [], contacts: [] };
    });
    sorted.forEach((o) => {
      if (o.upperLevelOrgId && orgMap[o.upperLevelOrgId]) {
        orgMap[o.upperLevelOrgId].children.push(orgMap[o.organizationId]);
      }
    });

    let root: OrgTreeNode | undefined;
    for (const o of sorted) {
      if (!o.upperLevelOrgId || !orgMap[o.upperLevelOrgId]) {
        root = orgMap[o.organizationId];
        break;
      }
    }

    contacts.forEach((c) => {
      if (orgMap[c.organizationId]) {
        orgMap[c.organizationId].contacts.push(c);
      }
    });
    if (!root) {
      root = orgMap[sorted[0].organizationId];
    }
    return root;
  }

  function layoutOrgTree(root: OrgTreeNode): PositionedNode {
    const horizontalGap = 180;
    const verticalGap = 40;

    function computePos(node: OrgTreeNode, startX: number, startY: number): PositionedNode {
      const isLeaf = (node.children.length === 0);
      const boxWidth = isLeaf
        ? (node.contacts.length * 80 + 60)
        : 150;

      let myHeight = 0;
      if (isLeaf) {
        myHeight = BOX_TOP_PADDING + 20;
      } else {
        const cCount = node.contacts.length;
        const contactArea = cCount * CONTACT_BOX_HEIGHT
          + (cCount > 0 ? (cCount - 1) * CONTACT_BOX_GAP : 0);
        myHeight = BOX_TOP_PADDING + contactArea;
      }

      let childY = startY;
      const children: PositionedNode[] = [];

      node.children.forEach((child) => {
        const pos = computePos(child, startX + horizontalGap, childY);
        children.push(pos);
        childY = pos.subtreeMaxY + verticalGap;
      });

      let subtreeMinY = startY;
      let subtreeMaxY = startY + myHeight;
      if (children.length > 0) {
        subtreeMaxY = Math.max(subtreeMaxY, children[children.length - 1].subtreeMaxY);
      }

      return {
        org: node.org,
        x: startX,
        y: startY,
        width: boxWidth,
        height: myHeight,
        contacts: node.contacts,
        children,
        subtreeMinY,
        subtreeMaxY,
        fillColor: getColorByLevelAvg(node.contacts),
      };
    }

    return computePos(root, 0, 0);
  }

  //
  // 7) ツリー描画
  //
  function createStepPath(x1: number, y1: number, x2: number, y2: number) {
    const midX = (x1 + x2) / 2;
    return `M${x1},${y1}H${midX}V${y2}H${x2}`;
  }

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
      <React.Fragment key={node.org.organizationId}>
        {connectionPath && (
          <path d={connectionPath} stroke="#666" fill="none" strokeWidth={2} />
        )}
        {renderOrgBox(node)}
        {node.children.map((child) => renderTree(child, node))}
      </React.Fragment>
    );
  }

  

  //
  // 8) 組織ボックス
  //
  function renderOrgBox(node: PositionedNode) {
    const onOrgBoxClick = (e: React.MouseEvent<SVGRectElement>) => {
      e.stopPropagation();
      setSelectedEntity({ type: 'org', orgId: node.org.organizationId });
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
          {node.org.organizationName} (order={node.org.siblingLevelOrgOrder})
        </text>

        {/* ドラッグハンドル */}
        <rect
          x={node.width - 30}
          y={5}
          width={25}
          height={25}
          fill="#aaa"
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDragCandidate({
              entityType: 'org',
              entityId: node.org.organizationId,
              startX: e.clientX,
              startY: e.clientY
            });
            document.body.style.userSelect = 'none';
          }}
        />
        <text x={node.width - 25} y={23} fontSize={12} fill="#000">
          ≡
        </text>

        {/* ハイライト */}
        {dragOverOrgId === node.org.organizationId
          && draggingState?.entityType === 'org'
          && draggingState.entityId !== node.org.organizationId
          && <InsertionIndicator node={node} mode={dragOverMode} />
        }

        {/* contacts */}
        {node.children.length === 0
          ? renderContactsHorizontal(node)
          : renderContactsVertical(node)}
      </g>
    );
  }

  //
  // 9) Contact描画
  //
  function renderContactsVertical(node: PositionedNode) {
    return node.contacts.map((contact, i) => {
      const cy = BOX_TOP_PADDING + i * (CONTACT_BOX_HEIGHT + CONTACT_BOX_GAP);
      return (
        <g
          key={contact.contactId}
          transform={`translate(10, ${cy})`}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDragCandidate({
              entityType: 'contact',
              entityId: contact.contactId,
              startX: e.clientX,
              startY: e.clientY
            });
            document.body.style.userSelect = 'none';
          }}
        >
          <rect
            width={node.width - 20}
            height={CONTACT_BOX_HEIGHT}
            fill={getColorByLevel(contact.contactLevel)}
            stroke="#000"
            strokeWidth={1}
          />
          <text x={5} y={15} fontSize={12} fill="#000">
            {truncateContactLabel(contact)}
          </text>
        </g>
      );
    });
  }

  function renderContactsHorizontal(node: PositionedNode) {
    const contactWidth = 80;
    const gap = 5;
    return node.contacts.map((c, i) => {
      const cx = 10 + i * (contactWidth + gap);
      const cy = 40;
      return (
        <g
          key={c.contactId}
          transform={`translate(${cx}, ${cy})`}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDragCandidate({
              entityType: 'contact',
              entityId: c.contactId,
              startX: e.clientX,
              startY: e.clientY
            });
            document.body.style.userSelect = 'none';
          }}
        >
          <rect
            width={contactWidth}
            height={CONTACT_BOX_HEIGHT}
            fill={getColorByLevel(c.contactLevel)}
            stroke="#000"
            strokeWidth={1}
          />
          <text x={5} y={15} fontSize={12} fill="#000">
            {truncateContactLabel(c)}
          </text>
        </g>
      );
    });
  }

  //
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

  //
  // 11) モーダル
  //
  const renderModalContent = () => {
    if (!selectedEntity) return null;

    if (selectedEntity.type === 'org') {
      const org = orgData.find((o) => o.organizationId === selectedEntity.orgId);
      if (!org) return <Box>Not found</Box>;
      return (
        <>
          <ModalHeader>組織情報</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>ID: {org.organizationId}</Box>
            <Box>Name: {org.organizationName}</Box>
            <Box>Parent: {org.upperLevelOrgId}</Box>
            <Box>Order: {org.siblingLevelOrgOrder}</Box>
            <Box>memo: {org.memo}</Box>
            <Box mt={4}>
              <Button
                colorScheme="red"
                onClick={() => {
                  onClose();
                  handleDeleteOrg(org.organizationId);
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
    } else {
      const c = contactData.find((ct) => ct.contactId === selectedEntity.contactId);
      if (!c) return <Box>Not found</Box>;
      return (
        <>
          <ModalHeader>Contact情報</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>{c.lastName} {c.firstName} ({c.title})</Box>
            <Box>説明: {c.contactDescription}</Box>
            <Box mt={2}>Level: {c.contactLevel}</Box>
            <NumberInput
              min={0}
              max={5}
              value={c.contactLevel}
              onChange={(_, val) => {
                if (val >= 0 && val <= 5) {
                  updateContact({ ...c, contactLevel: val });
                }
              }}
            >
              <NumberInputField />
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

  //
  // 12) ドラッグゴースト(シンプル)
  //
  const renderDragGhost = () => {
    if (!draggingState) return null;
    const { entityType, entityId } = draggingState;

    if (entityType === 'contact') {
      // Contactゴースト
      const c = contactData.find((x) => x.contactId === entityId);
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
      const o = orgData.find((oo) => oo.organizationId === entityId);
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

  //
  // レンダリング
  //
  const svgWidth = 1200;
  const svgHeight = 800;

  return (
    <Box p={4}>
      <Box as="h1" fontSize="lg" mb={4}>
        Sales Heat Map (Highlight only target node)
      </Box>

      <Box mb={2}>
        <Button colorScheme="blue" onClick={handleResetData} mr={4}>
          リセット
        </Button>
        <Input
          placeholder="新しい組織名"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
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
          style={{ background: '#fafafa' }}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerLeave={onSvgPointerLeave}
          onWheel={onSvgWheel}
        >
          <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
            {positionedRoot && renderTree(positionedRoot)}
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

//
// ツリー構築
//
// function buildOrgTree(orgs: Organization[], contacts: Contact[]): OrgTreeNode {
//   const sorted = [...orgs].sort((a, b) => a.siblingLevelOrgOrder - b.siblingLevelOrgOrder);
//   const orgMap: Record<string, OrgTreeNode> = {};
//   sorted.forEach((o) => {
//     orgMap[o.organizationId] = { org: o, children: [], contacts: [] };
//   });
//   sorted.forEach((o) => {
//     if (o.upperLevelOrgId && orgMap[o.upperLevelOrgId]) {
//       orgMap[o.upperLevelOrgId].children.push(orgMap[o.organizationId]);
//     }
//   });

//   let root: OrgTreeNode | undefined;
//   for (const o of sorted) {
//     if (!o.upperLevelOrgId || !orgMap[o.upperLevelOrgId]) {
//       root = orgMap[o.organizationId];
//       break;
//     }
//   }

//   contacts.forEach((c) => {
//     if (orgMap[c.organizationId]) {
//       orgMap[c.organizationId].contacts.push(c);
//     }
//   });
//   if (!root) {
//     root = orgMap[sorted[0].organizationId];
//   }
//   return root;
// }

//
// レイアウト
//
// function layoutOrgTree(root: OrgTreeNode): PositionedNode {
//   const horizontalGap = 180;
//   const verticalGap = 40;

//   function computePos(node: OrgTreeNode, startX: number, startY: number): PositionedNode {
//     const isLeaf = (node.children.length === 0);
//     const boxWidth = isLeaf
//       ? (node.contacts.length * 80 + 60)
//       : 150;

//     let myHeight = 0;
//     if (isLeaf) {
//       myHeight = BOX_TOP_PADDING + 20;
//     } else {
//       const cCount = node.contacts.length;
//       const contactArea = cCount * CONTACT_BOX_HEIGHT
//         + (cCount > 0 ? (cCount - 1) * CONTACT_BOX_GAP : 0);
//       myHeight = BOX_TOP_PADDING + contactArea;
//     }

//     let childY = startY;
//     const children: PositionedNode[] = [];

//     node.children.forEach((child) => {
//       const pos = computePos(child, startX + horizontalGap, childY);
//       children.push(pos);
//       childY = pos.subtreeMaxY + verticalGap;
//     });

//     let subtreeMinY = startY;
//     let subtreeMaxY = startY + myHeight;
//     if (children.length > 0) {
//       subtreeMaxY = Math.max(subtreeMaxY, children[children.length - 1].subtreeMaxY);
//     }

//     return {
//       org: node.org,
//       x: startX,
//       y: startY,
//       width: boxWidth,
//       height: myHeight,
//       contacts: node.contacts,
//       children,
//       subtreeMinY,
//       subtreeMaxY,
//       fillColor: getColorByLevelAvg(node.contacts),
//     };
//   }

//   return computePos(root, 0, 0);
// }

//
// カラー
//
function getColorByLevelAvg(contacts: Contact[]) {
  if (!contacts.length) return '#fff';
  const sum = contacts.reduce((acc, c) => acc + c.contactLevel, 0);
  const avg = Math.floor(sum / contacts.length);
  return getColorByLevel(avg);
}

function getColorByLevel(level: number) {
  switch (level) {
    case 0: return '#fff';
    case 1: return '#cce0ff';
    case 2: return '#99c2ff';
    case 3: return '#66a3ff';
    case 4: return '#3385ff';
    case 5: return '#0033ff';
    default: return '#fff';
  }
}

function truncateContactLabel(c: Contact) {
  const full = `${c.lastName} ${c.firstName}`;
  if (full.length > 15) {
    return full.slice(0, 14) + '…';
  }
  return full;
}

//
// エクスポート
//
export default SalesHeatMapPage;