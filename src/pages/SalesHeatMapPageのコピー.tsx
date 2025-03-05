import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Button,
  useToast,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
} from '@chakra-ui/react';
import { RxReset } from "react-icons/rx";
import ContactPage from "./ContactPage";
import opportunitiesData from './opportunities.json';
import activitiesData from "./activities.json";
/** ---------------------------------------------------------------
 * 型定義
 ---------------------------------------------------------------- */
interface Organization {
  organizationId: string;
  organizationName: string;
  upperLevelOrgId: string;
  memo: string;
}
interface Contact {
  contactId: string;
  lastName: string;
  firstName: string;
  organizationId: string;
  title: string;
  contactLevel: number;
  contactDescription: string;
  keyPerson: boolean
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

// モーダル用
type SelectedEntity =
  | { type: 'org'; orgId: string }
  | { type: 'contact'; contactId: string }
  | null;

// ドラッグ関連
type DragCandidate = {
  contactId: string;
  startX: number;
  startY: number;
};
type DraggingContactState = {
  contactId: string;
  offsetX: number;
  offsetY: number;
} | null;

interface Opportunity {
  contactId: string;
  CustomerName: string;
  ProductName: string;
  OpportunityName: string;
  Distributor: string;
  Application: string;
  Territory: string;
  TargetPrice: number;
  CustomerBudget: number;
  CompetitorPrice: number;
  CurrentStatus: string;
  // 他の必要なプロパティがあれば追加
}


const STORAGE_KEY_ORG = 'o1pro_organizations';
const STORAGE_KEY_CONTACT = 'o1pro_contacts';

const SalesHeatMapPage: React.FC = () => {
  const toast = useToast();

  const [orgData, setOrgData] = useState<Organization[]>([]);
  const [contactData, setContactData] = useState<Contact[]>([]);
  const [positionedRoot, setPositionedRoot] = useState<PositionedNode | null>(null);
  // 既存のインポートの下などで定義
  // 修正: opportunities の useState の型指定
  const [opportunities, setOpportunities] = useState<Opportunity[]>(opportunitiesData as any);
  const [activities, setActivities] = useState(activitiesData);


  // Pan/Zoom
  const [translateX, setTranslateX] = useState(50);
  const [translateY, setTranslateY] = useState(50);
  const [scale, setScale] = useState(1);
  const isPanningRef = useRef(false);
  const lastPointerPosRef = useRef({ x: 0, y: 0 });

  // SVG参照
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ドラッグ
  const [dragCandidate, setDragCandidate] = useState<DragCandidate | null>(null);
  const [draggingContact, setDraggingContact] = useState<DraggingContactState>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

  // モーダル
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);

  /** ★ (1) データ読み込み */
  useEffect(() => {
    const loadData = async () => {
      try {
        import('./organizations.json').then((orgJson) => {
          setOrgData(orgJson.default); 
        });
        import('./contacts.json').then((contactJson) => {
          setContactData(contactJson.default);
        });
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, []);

  /** ★ (2) orgData/contactData の変化時にレイアウト再計算 */
  useEffect(() => {
    if (orgData.length === 0) return;
    reLayout();
  }, [orgData, contactData]);

  const reLayout = () => {
    const root = buildOrgTree(orgData, contactData);
    const posRoot = layoutOrgTree(root);
    setPositionedRoot(posRoot);
  };

  /** Contact 更新 -> 即再レイアウト */
  const updateContact = (updated: Contact) => {
    const newContacts = contactData.map((c) =>
      c.contactId === updated.contactId ? updated : c
    );
    setContactData(newContacts);
    localStorage.setItem(STORAGE_KEY_CONTACT, JSON.stringify(newContacts));
    reLayout();

    toast({
      title: 'Contact Updated',
      description: 'contactLevelや組織が更新されました。',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  /** リセット */
  const handleResetData = async () => {
    try {
      const [orgModule, contactModule, activitiesModule, opportunitiesModule] = await Promise.all([
          import('./organizations.json'),
          import('./contacts.json'),
          import('./activities.json'),
          import('./opportunities.json'),
        ]);
        const orgJson = orgModule.default;
        const contactJson = contactModule.default;
        const activitiesJson = activitiesModule.default;
        const opportunitiesJson = opportunitiesModule.default;
        setOrgData(orgJson);
        setContactData(contactJson);
        setActivities(activitiesJson);
        setOpportunities(opportunitiesJson as any);
        localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(orgJson));
        localStorage.setItem(STORAGE_KEY_CONTACT, JSON.stringify(contactJson));
        localStorage.setItem('activities', JSON.stringify(activitiesJson));
        localStorage.setItem('opportunities', JSON.stringify(opportunitiesJson));
      toast({
        title: 'Reset',
        description: '初期データに戻しました。',
        status: 'info',
        duration: 2000,
        isClosable: true,
      });
    } catch (err) {
      console.error(err);
    }
  };

  /** ★ (3) Pan/Zoom */
  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragCandidate || draggingContact) return;
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
    // ドラッグ開始判定
    if (dragCandidate && !draggingContact) {
      const distX = e.clientX - dragCandidate.startX;
      const distY = e.clientY - dragCandidate.startY;
      const distance = Math.sqrt(distX * distX + distY * distY);
      if (distance > 5) {
        setDraggingContact({
          contactId: dragCandidate.contactId,
          offsetX: 0,
          offsetY: 0,
        });
      }
    }
    if (draggingContact) {
      setDragX(e.clientX);
      setDragY(e.clientY);
    }
  };
  const onSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isPanningRef.current = false;
    document.body.style.userSelect = 'auto';

    if (draggingContact) {
      dropContact(e.clientX, e.clientY);
      setDraggingContact(null);
      setDragCandidate(null);
      return;
    }
    // クリック
    if (dragCandidate) {
      const c = contactData.find((x) => x.contactId === dragCandidate.contactId);
      if (c) {
        setSelectedEntity({ type: 'contact', contactId: c.contactId });
        onOpen();
      }
      setDragCandidate(null);
    }
  };
  const onSvgPointerLeave = () => {
    isPanningRef.current = false;
    setDraggingContact(null);
    setDragCandidate(null);
    document.body.style.userSelect = 'auto';
  };

  /** Contactドラッグ候補 */
  const handleContactPointerDown = (e: React.PointerEvent, contactId: string) => {
    e.stopPropagation();
    setDragCandidate({ contactId, startX: e.clientX, startY: e.clientY });
    document.body.style.userSelect = 'none';
  };

  /** ドロップ */
  const dropContact = (screenX: number, screenY: number) => {
    if (!draggingContact || !positionedRoot) return;
    const c = contactData.find((x) => x.contactId === draggingContact.contactId);
    if (!c) return;
    const { diagramX, diagramY } = screenToDiagramCoord(screenX, screenY);
    const foundOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
    if (foundOrgId) {
      // 組織変更
      const updated = { ...c, organizationId: foundOrgId };
      updateContact(updated); // これで boxWidth も再計算される
    }
  };

  const screenToDiagramCoord = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { diagramX: 0, diagramY: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const diagramX = (sx - translateX) / scale;
    const diagramY = (sy - translateY) / scale;
    return { diagramX, diagramY };
  };

  const findOrgNodeAt = (node: PositionedNode, x: number, y: number): string | null => {
    if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
      return node.org.organizationId;
    }
    for (const child of node.children) {
      const found = findOrgNodeAt(child, x, y);
      if (found) return found;
    }
    return null;
  };

  /** ★ (4) SVG描画 */
  const renderTree = (node: PositionedNode, parent?: PositionedNode) => {
    let connectionPath;
    if (parent) {
      // step lineは 上のほう(= y+20)から
      const startX = parent.x + parent.width;
      const startY = parent.y + 20;
      const endX = node.x;
      const endY = node.y + 20;
      connectionPath = createStepPath(startX, startY, endX, endY);
    }

    return (
      <React.Fragment key={node.org.organizationId}>
        {connectionPath && <path d={connectionPath} stroke="#666" fill="none" strokeWidth={2} />}

        <g transform={`translate(${node.x}, ${node.y})`}>
          <rect
            width={node.width}
            height={node.height}
            fill={node.fillColor}
            stroke="#333"
            strokeWidth={1.5}
            rx={1}
            ry={1}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedEntity({ type: 'org', orgId: node.org.organizationId });
              onOpen();
            }}
          />
          <text x={10} y={20} fontSize={14} fill="#000">
            {node.org.organizationName}
          </text>

          {/* contacts表示 (leafは横, non-leafは縦) */}
          {node.children.length === 0
            ? renderContactsHorizontal(node)
            : renderContactsVertical(node)}
        </g>

        {node.children.map((child) => renderTree(child, node))}
      </React.Fragment>
    );
  };

  const renderContactsVertical = (node: PositionedNode) => {
    return node.contacts.map((contact, i) => {
      const cy = BOX_TOP_PADDING + i * (CONTACT_BOX_HEIGHT + CONTACT_BOX_GAP);
      return (
        <g
          key={contact.contactId}
          transform={`translate(10, ${cy})`}
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => handleContactPointerDown(e, contact.contactId)}
        >
          <rect
            width={node.width - 20}
            height={CONTACT_BOX_HEIGHT}
            fill={contactHasOpportunity(contact.contactId) ? "#DAFFF1" : "#ffffff"}
            stroke={contact.keyPerson ? "#0ACF83" : "#000"}
            strokeWidth={1}
            rx={8}
            ry={8}
          />
           <text x={5} y={15} fontSize={12} fill="#000">
             {truncateContactLabel(contact)}
           </text>
           {getActivityCount(contact.contactId) > 0 && (
            <>
              <circle cx={node.width - 10} cy={CONTACT_BOX_HEIGHT / 2} r={8} fill="#fff" stroke="#0ACF83" strokeWidth={1} />
              <text x={node.width - 13} y={(CONTACT_BOX_HEIGHT / 2) + 3} fontSize={8} fill="#0ACF83">
                {getActivityCount(contact.contactId)}
              </text>
            </>
          )}
        </g>
      );
    });
  };

  const renderContactsHorizontal = (node: PositionedNode) => {
    // leafの場合、contactsを (10 + i*(80+gap), 40) に配置
    const contactWidth = 80;
    const contactHeight = CONTACT_BOX_HEIGHT;
    const gap = 5;
    return node.contacts.map((c, i) => {
      const cx = 10 + i * (contactWidth + gap);
      const cy = 40;
      return (
        <g
          key={c.contactId}
          transform={`translate(${cx}, ${cy})`}
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => handleContactPointerDown(e, c.contactId)}
        >
          <rect
            width={contactWidth}
            height={contactHeight}
            fill={contactHasOpportunity(c.contactId) ? "#DAFFF1" : "#ffffff"}
            stroke={c.keyPerson ? "#0ACF83" : "#000"}
            strokeWidth={1}
            rx={8}
            ry={8}
          />
           <text x={5} y={15} fontSize={12} fill="#000">
             {truncateContactLabel(c)}
           </text>
           {getActivityCount(c.contactId) > 0 && (
           <>
           <circle cx={contactWidth - 10} cy={contactHeight / 2} r={8} fill="#fff" stroke="#0ACF83" strokeWidth={1} />
           <text x={contactWidth - 13} y={(contactHeight / 2) + 3} fontSize={8} fill="#0ACF83">
             {getActivityCount(c.contactId)}
           </text>
           </>
         )}
        </g>
      );
    });
  };

  /** (5) モーダル */
  const renderModalContent = () => {
    if (!selectedEntity) return null;

    if (selectedEntity.type === 'org') {
      const org = orgData.find((o) => o.organizationId === selectedEntity.orgId);
      if (!org) return <Box>組織が見つかりません</Box>;

      return (
        <>
          <ModalHeader>組織情報</ModalHeader>
          <ModalCloseButton />
          <ModalBody minWidth="70vw">
            <Box>組織ID: {org.organizationId}</Box>
            <Box>組織名: {org.organizationName}</Box>
            <Box>メモ: {org.memo}</Box>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>閉じる</Button>
          </ModalFooter>
        </>
      );
      } else {
        const c = contactData.find((x) => x.contactId === selectedEntity.contactId);
        if (!c) return <Box>Contactが見つかりません</Box>;
  
        return (
        <ContactPage 
          contact={c} 
          onClose={onClose} 
          onAddActivity={handleAddActivity}
          onAddOpportunity={handleAddOpportunity}
          activities={activities}           // 追加
          opportunities={opportunities} 
        />
        );
      }
  };

  /** (6) ドラッグ中のゴースト描画 */
  const renderDragGhost = () => {
    if (!draggingContact) return null;
    const c = contactData.find((x) => x.contactId === draggingContact.contactId);
    if (!c) return null;

    const boxWidth = 80; // leaf表示時と合わせる
    const boxHeight = CONTACT_BOX_HEIGHT;
    const style: React.CSSProperties = {
      position: 'fixed',
      left: dragX - 10 + 'px',
      top: dragY - 10 + 'px',
      width: boxWidth + 'px',
      height: boxHeight + 'px',
      backgroundColor: contactHasOpportunity(c.contactId) ? "#DAFFF1" : "#ffffff",
      border: '1px solid #000',
      opacity: 0.7,
      pointerEvents: 'none',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '8px',
      color: '#000',
    };
    const label = `${c.lastName} ${c.firstName}`;
    return <div style={style}>{label}</div>;
  };

  /** (7) レンダリング */
  const svgWidth = 1200;
  const svgHeight = 800;
  console.log(svgHeight)

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

  // 指定の contactId に対して、opportunity があるかチェックする
  function contactHasOpportunity(contactId: string): boolean {
    return opportunities.filter((opp: { contactId: string }) => opp.contactId === contactId).length > 0;
  }

  // 各 contactId に紐づく activities の数を返す関数
  function getActivityCount(contactId: string): number {
    return activities.filter((act: { contactId: string }) => act.contactId === contactId).length;
  }

  const handleAddActivity = (newActivity) => {
    setActivities(prev => [...prev, newActivity]);
    // 必要に応じて再レイアウトなどを実施
  };
  
  const handleAddOpportunity = (newOpportunity) => {
    setOpportunities(prev => [...prev, newOpportunity]);
    // 必要に応じて再レイアウトなどを実施
  };

  return (
     <Box
       position="relative" // fixedからrelativeに変更
       p={6}
       overflow="auto"
       bg="white"
        >
      <HStack mb={4}>
        <Button onClick={handleZoomIn} mr={1} w="30px" h="30px" borderRadius="full">＋</Button>
        <Button onClick={handleZoomOut}　mr={1} w="30px" h="30px" borderRadius="full">－</Button>
        <Box onClick={handleResetData} cursor="pointer">
          <RxReset />
        </Box>
      </HStack>

      <Box
        border="1px solid #ccc"
        w={`${svgWidth}px`}
        // h={`${svgHeight}px`}
        position="relative"
        // overflow="hidden"
        mt={4}
        overflow="auto"
      >
        <svg
          ref={svgRef}
          // width={svgWidth}
          // height={svgHeight}
          style={{ background: '#f9f9f9' }}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerLeave={onSvgPointerLeave}
          // onWheel={onSvgWheel}
          width={2000}
          height={1500}
        >
          <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
            {positionedRoot && renderTree(positionedRoot)}
          </g>
        </svg>

        {renderDragGhost()}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalBody minWidth="70vw">
          <ModalContent minWidth="70vw">{renderModalContent()}</ModalContent>
        </ModalBody>
      </Modal>
    </Box>
  );
};

export default SalesHeatMapPage;

/** ----------------------------------------------------------------
 * レイアウト計算
 ---------------------------------------------------------------- */
const BOX_TOP_PADDING = 40;
const CONTACT_BOX_HEIGHT = 20;
const CONTACT_BOX_GAP = 5;

function buildOrgTree(orgs: Organization[], contacts: Contact[]): OrgTreeNode {
  const orgMap: Record<string, OrgTreeNode> = {};
  orgs.forEach((o) => {
    orgMap[o.organizationId] = { org: o, children: [], contacts: [] };
  });

  orgs.forEach((o) => {
    if (o.upperLevelOrgId && orgMap[o.upperLevelOrgId]) {
      orgMap[o.upperLevelOrgId].children.push(orgMap[o.organizationId]);
    }
  });

  let root: OrgTreeNode | undefined;
  for (const o of orgs) {
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
    root = orgMap[orgs[0].organizationId];
  }
  return root;
}

/** 
 * layoutOrgTree: 末端(leaf)なら Box幅を contact人数にあわせて動的に
 *  - leaf: boxWidth = (人数 * 80) + 50
 *  - non-leaf: boxWidth = 200
 */
function layoutOrgTree(root: OrgTreeNode): PositionedNode {
  const horizontalGap = 175;
  const verticalGap = 10;

  function computePos(node: OrgTreeNode, startX: number, startY: number): PositionedNode {
    const isLeaf = (node.children.length === 0);

    // leaf → box幅を人数に応じて変える
    let boxWidth = isLeaf
      ? (node.contacts.length * 80) + 60 // 人数*80 + 余白50
      : 150;

    // 高さは "40 + (contacts縦表示分 or 1行 or etc)"
    // ここでは leaf は 1行(=20) で済ます例
    let myHeight = 0;
    const boxBottomPadding = 10;

    if (isLeaf) {
      // leafの場合 40 + 1行(=20) だけ確保(contactsを横並び)
      // ※ contactが多いと横に伸びるので,Boxのheightは 40+20 =60
      myHeight = BOX_TOP_PADDING + 20 + boxBottomPadding;
    } else {
      // non-leaf → 縦並び
      const cCount = node.contacts.length;
      const contactAreaHeight =
        cCount * CONTACT_BOX_HEIGHT +
        (cCount > 0 ? (cCount - 1) * CONTACT_BOX_GAP : 0);
      myHeight = BOX_TOP_PADDING + contactAreaHeight + boxBottomPadding;
    }

    let childY = startY;
    const childPNodes: PositionedNode[] = [];

    node.children.forEach((child) => {
      const childPos = computePos(child, startX + horizontalGap, childY);
      childPNodes.push(childPos);

      childY = childPos.subtreeMaxY + verticalGap;
    });

    let subtreeMinY = startY;
    let subtreeMaxY = startY + myHeight;
    if (childPNodes.length > 0) {
      subtreeMaxY = Math.max(subtreeMaxY, childPNodes[childPNodes.length - 1].subtreeMaxY);
    }

    const fillColor = "#ffffff";

    return {
      org: node.org,
      x: startX,
      y: startY,
      width: boxWidth,
      height: myHeight,
      contacts: node.contacts,
      children: childPNodes,
      subtreeMinY,
      subtreeMaxY,
      fillColor,
    };
  }

  return computePos(root, 0, 0);
}

/** step path: y+20で上部から繋ぐ例 */
function createStepPath(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2;
  return `M${x1},${y1} H${midX} V${y2} H${x2}`;
}

function truncateContactLabel(c: Contact) {
  const full = `${c.lastName} ${c.firstName} `;//(${c.title})
  return (full.length > 15) ? full.slice(0, 14) + '…' : full;
}