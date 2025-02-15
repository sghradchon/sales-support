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

/** ----------------------------------------------------------------
 * 型定義
 ----------------------------------------------------------------- */
interface Organization {
  organizationId: string;
  organizationName: string;
  upperLevelOrgId: string;
  memo: string;
  orgOrder?: number; // ★ 並び順用 (オプション)
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

// モーダルで選択中
type SelectedEntity =
  | { type: 'org'; orgId: string }
  | { type: 'contact'; contactId: string }
  | null;

// ドラッグ対象の種別
type DragEntityType = 'contact' | 'org';

type DragCandidate = {
  entityType: DragEntityType;
  entityId: string;  // contactId or orgId
  startX: number;
  startY: number;
};

type DraggingState = {
  entityType: DragEntityType;
  entityId: string; // contactId or orgId
} | null;

const STORAGE_KEY_ORG = 'o1pro_organizations';
const STORAGE_KEY_CONTACT = 'o1pro_contacts';

/** ----------------------------------------------------------------
 * メインコンポーネント
 ----------------------------------------------------------------- */
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

  // SVG参照
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ドラッグ
  const [dragCandidate, setDragCandidate] = useState<DragCandidate | null>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

  // モーダル
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);

  // 「新しい組織を追加」用
  const [newOrgName, setNewOrgName] = useState('');

  /** ★ 1) データ読み込み */
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

  /** ★ 2) orgData/contactData が変わるたびにレイアウト再計算 */
  useEffect(() => {
    if (orgData.length === 0) return;
    reLayout();
  }, [orgData, contactData]);

  const reLayout = () => {
    const root = buildOrgTree(orgData, contactData);
    const posRoot = layoutOrgTree(root);
    setPositionedRoot(posRoot);
  };

  /** Contact更新 */
  const updateContact = (updated: Contact) => {
    const newContacts = contactData.map((c) =>
      c.contactId === updated.contactId ? updated : c
    );
    setContactData(newContacts);
    localStorage.setItem(STORAGE_KEY_CONTACT, JSON.stringify(newContacts));
    reLayout();

    toast({
      title: 'Contact Updated',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  /** Org更新(上位組織やorgOrder変更など) */
  const updateOrganization = (updated: Organization) => {
    const newOrgs = orgData.map((o) =>
      o.organizationId === updated.organizationId ? updated : o
    );
    setOrgData(newOrgs);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(newOrgs));
    reLayout();

    toast({
      title: 'Organization Updated',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  /** リセット */
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

  /** 組織追加 */
  const handleAddOrganization = () => {
    if (!newOrgName.trim()) return;
    const newId = `org_new_${Date.now()}`;
    const newOrg: Organization = {
      organizationId: newId,
      organizationName: newOrgName.trim(),
      upperLevelOrgId: '', // (root扱いにするor何か既存orgIdにする)
      memo: '',
      orgOrder: 999, // 末尾に追加
    };
    setOrgData([...orgData, newOrg]);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify([...orgData, newOrg]));
    setNewOrgName('');
  };

  /** 組織削除 */
  const handleDeleteOrg = (orgId: string) => {
    // 1) orgDataから削除
    const newOrgs = orgData.filter((o) => o.organizationId !== orgId);
    // 2) その組織の子(= upperLevelOrgId=orgId)をroot化 or さらに削除するなど要件次第
    //   ここでは「子組織をroot化する」例
    const children = orgData.filter((o) => o.upperLevelOrgId === orgId);
    const updatedChildren = children.map((c) => ({ ...c, upperLevelOrgId: '' }));

    let finalOrgs = newOrgs.map((o) => {
      const child = updatedChildren.find((uc) => uc.organizationId === o.organizationId);
      return child ?? o;
    });
    // 3) contactsに所属する人もどうするか (ここではそのまま)
    setOrgData(finalOrgs);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(finalOrgs));

    toast({
      title: 'Organization Deleted',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  /** ★ 3) Pan/Zoom */
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
    // ドラッグ開始判定
    if (dragCandidate && !draggingState) {
      const distX = e.clientX - dragCandidate.startX;
      const distY = e.clientY - dragCandidate.startY;
      const distance = Math.sqrt(distX * distX + distY * distY);
      if (distance > 5) {
        // ドラッグ開始
        setDraggingState({
          entityType: dragCandidate.entityType,
          entityId: dragCandidate.entityId,
        });
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
      return;
    }
    // クリック
    if (dragCandidate) {
      // entityType: 'contact'|'org'
      if (dragCandidate.entityType === 'contact') {
        // contactをクリックした
        const c = contactData.find((x) => x.contactId === dragCandidate.entityId);
        if (c) {
          setSelectedEntity({ type: 'contact', contactId: c.contactId });
          onOpen();
        }
      } else {
        // orgをクリックした
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

  /** ★ 4) Entityドラッグ候補開始 (Contact or Org) */
  const handleEntityPointerDown = (
    e: React.PointerEvent,
    entityType: DragEntityType,
    entityId: string
  ) => {
    e.stopPropagation();
    setDragCandidate({
      entityType,
      entityId,
      startX: e.clientX,
      startY: e.clientY,
    });
    document.body.style.userSelect = 'none';
  };

  /** ★ ドロップ処理 (Contact or Org) */
  const dropEntity = (screenX: number, screenY: number) => {
    if (!draggingState || !positionedRoot) return;
    const { entityType, entityId } = draggingState;

    const { diagramX, diagramY } = screenToDiagramCoord(screenX, screenY);

    // 組織ノードを探す
    const foundOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
    if (!foundOrgId) return;

    if (entityType === 'contact') {
      // 既存のContactを -> foundOrgId に移動
      const c = contactData.find((cc) => cc.contactId === entityId);
      if (!c) return;
      const updated: Contact = { ...c, organizationId: foundOrgId };
      updateContact(updated);
    } else {
      // entityType === 'org'
      const org = orgData.find((oo) => oo.organizationId === entityId);
      if (!org) return;
      if (org.organizationId === foundOrgId) {
        // 同じ組織にドロップ(=自分自身) → 何もしない
        return;
      }
      // 例: upperLevelOrgIdを変える
      // あるいは 兄弟内で順序変更 (同じ親なら)
      const newParent = orgData.find((p) => p.organizationId === foundOrgId);
      if (!newParent) {
        // ルート化  (foundOrgId が無い or そのorgが見つからない)
        const updatedOrg: Organization = { ...org, upperLevelOrgId: '' };
        updateOrganization(updatedOrg);
      } else {
        // 兄弟内ソート or 親変更
        // ここでは「単純に親を foundOrgId にする」例
        const updatedOrg: Organization = { ...org, upperLevelOrgId: foundOrgId };

        // もし同じ親だったら -> 兄弟順入れ替え(=orgOrder再設定)などする
        if (org.upperLevelOrgId === newParent.upperLevelOrgId) {
          // TODO: orgOrderの再計算
          updatedOrg.orgOrder = (newParent.orgOrder ?? 999) + 0.1; 
          // ※実際は兄弟すべてのorgOrderを再ソートするなど複雑
        }

        updateOrganization(updatedOrg);
      }
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

  /** findOrgNodeAt: クリック位置にある組織を探す */
  const findOrgNodeAt = (
    node: PositionedNode,
    x: number,
    y: number
  ): string | null => {
    if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
      return node.org.organizationId;
    }
    for (const child of node.children) {
      const found = findOrgNodeAt(child, x, y);
      if (found) return found;
    }
    return null;
  };

  /** ★ 5) SVG描画 */
  const renderTree = (node: PositionedNode, parent?: PositionedNode) => {
    let connectionPath: string | undefined;
    if (parent) {
      // step line: parent上部 ~ child上部
      const startX = parent.x + parent.width;
      const startY = parent.y + 20;
      const endX = node.x;
      const endY = node.y + 20;
      connectionPath = createStepPath(startX, startY, endX, endY);
    }

    // 組織ノード(<rect>)をドラッグ可能に
    const handleOrgPointerDown = (e: React.PointerEvent) => {
      handleEntityPointerDown(e, 'org', node.org.organizationId);
    };

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
            rx={6}
            ry={6}
            style={{ cursor: 'grab' }}
            onPointerDown={handleOrgPointerDown}
            onClick={(e) => {
              // orgをクリック(※ ドラッグではなく、ほんの少しの移動ですむ時)
              e.stopPropagation();
              setSelectedEntity({ type: 'org', orgId: node.org.organizationId });
              onOpen();
            }}
          />
          <text x={10} y={20} fontSize={14} fill="#000">
            {node.org.organizationName}
          </text>

          {/* leaf or non-leaf で contacts描画を分ける */}
          {node.children.length === 0
            ? renderContactsHorizontal(node)
            : renderContactsVertical(node)}
        </g>

        {node.children.map((child) => renderTree(child, node))}
      </React.Fragment>
    );
  };

  /** contactをドラッグ可能に (既存同様) */
  const handleContactPointerDown = (e: React.PointerEvent, contactId: string) => {
    handleEntityPointerDown(e, 'contact', contactId);
  };

  const renderContactsVertical = (node: PositionedNode) => {
    return node.contacts.map((contact, i) => {
      const cy = BOX_TOP_PADDING + i * (CONTACT_BOX_HEIGHT + CONTACT_BOX_GAP);
      return (
        <g
          key={contact.contactId}
          transform={`translate(10, ${cy})`}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => handleContactPointerDown(e, contact.contactId)}
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
  };

  const renderContactsHorizontal = (node: PositionedNode) => {
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
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => handleContactPointerDown(e, c.contactId)}
        >
          <rect
            width={contactWidth}
            height={contactHeight}
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
  };

  /** ★ 6) モーダル描画 */
  const renderModalContent = () => {
    if (!selectedEntity) return null;

    if (selectedEntity.type === 'org') {
      const org = orgData.find((o) => o.organizationId === selectedEntity.orgId);
      if (!org) return <Box>組織が見つかりません</Box>;

      return (
        <>
          <ModalHeader>組織情報</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>組織ID: {org.organizationId}</Box>
            <Box>組織名: {org.organizationName}</Box>
            <Box>メモ: {org.memo}</Box>
            <Box mt={4}>
              <Button
                colorScheme="red"
                onClick={() => {
                  onClose();
                  handleDeleteOrg(org.organizationId);
                }}
              >
                この組織を削除
              </Button>
            </Box>
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
        <>
          <ModalHeader>Contact情報</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>氏名: {c.lastName} {c.firstName}</Box>
            <Box>役職: {c.title}</Box>
            <Box>説明: {c.contactDescription}</Box>
            <Box mt={4}>contactLevel:</Box>
            <NumberInput
              min={0}
              max={5}
              value={c.contactLevel}
              onChange={(strVal, numVal) => {
                console.log("contactLevel strVal",strVal)
                if (numVal >= 0 && numVal <= 5) {
                  updateContact({ ...c, contactLevel: numVal });
                }
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
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

  /** ★ 7) ドラッグ中のゴースト (Org or Contact) */
  const renderDragGhost = () => {
    if (!draggingState) return null;
    const { entityType, entityId } = draggingState;

    if (entityType === 'contact') {
      // contact ghost
      const c = contactData.find((x) => x.contactId === entityId);
      if (!c) return null;
      const boxWidth = 80;
      const boxHeight = CONTACT_BOX_HEIGHT;
      const style: React.CSSProperties = {
        position: 'fixed',
        left: dragX - 10 + 'px',
        top: dragY - 10 + 'px',
        width: boxWidth + 'px',
        height: boxHeight + 'px',
        backgroundColor: getColorByLevel(c.contactLevel),
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
    } else {
      // org ghost
      const o = orgData.find((x) => x.organizationId === entityId);
      if (!o) return null;
      const style: React.CSSProperties = {
        position: 'fixed',
        left: dragX - 20 + 'px',
        top: dragY - 10 + 'px',
        width: '150px',
        height: '40px',
        backgroundColor: '#ffcccc',
        border: '1px solid #f00',
        opacity: 0.8,
        pointerEvents: 'none',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '8px',
        color: '#000',
      };
      return <div style={style}>{o.organizationName}</div>;
    }
  };

  /** ★ レンダリング */
  const svgWidth = 1200;
  const svgHeight = 800;

  return (
    <Box p={4}>
      <Box as="h1" fontSize="xl" mb={4}>
        Sales Heat Map: Organizations & Contacts (Drag & Drop both)
      </Box>

      <Box mb={2}>
        <Button colorScheme="blue" onClick={handleResetData} mr={4}>
          データを初期状態にリセット
        </Button>

        {/* 新しい組織を追加するUI */}
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
        w={`${svgWidth}px`}
        h={`${svgHeight}px`}
        position="relative"
        overflow="hidden"
      >
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          style={{ background: '#f9f9f9' }}
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
        <ModalContent>{renderModalContent()}</ModalContent>
      </Modal>
    </Box>
  );
};

/** ----------------------------------------------------------------
 * レイアウト計算
 ----------------------------------------------------------------- */
const BOX_TOP_PADDING = 40;
const CONTACT_BOX_HEIGHT = 20;
const CONTACT_BOX_GAP = 5;

function buildOrgTree(orgs: Organization[], contacts: Contact[]): OrgTreeNode {
  // もし orgOrder が設定されていればソート
  const sortedOrgs = [...orgs].sort((a, b) => {
    const aa = a.orgOrder ?? 9999;
    const bb = b.orgOrder ?? 9999;
    return aa - bb;
  });

  const orgMap: Record<string, OrgTreeNode> = {};
  sortedOrgs.forEach((o) => {
    orgMap[o.organizationId] = { org: o, children: [], contacts: [] };
  });

  sortedOrgs.forEach((o) => {
    if (o.upperLevelOrgId && orgMap[o.upperLevelOrgId]) {
      orgMap[o.upperLevelOrgId].children.push(orgMap[o.organizationId]);
    }
  });

  // root
  let root: OrgTreeNode | undefined;
  for (const o of sortedOrgs) {
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
    root = orgMap[sortedOrgs[0].organizationId];
  }
  return root;
}

/**
 * layoutOrgTree:
 *   末端(leaf)は横並び, それ以外は縦並び。
 *   boxWidth はleafなら #contacts*80+50, non-leaf=150
 */
function layoutOrgTree(root: OrgTreeNode): PositionedNode {
  const horizontalGap = 180;
  const verticalGap = 40;

  function computePos(node: OrgTreeNode, startX: number, startY: number): PositionedNode {
    const isLeaf = (node.children.length === 0);

    let boxWidth = isLeaf
      ? (node.contacts.length * 80 + 60)
      : 150;

    // 同様に高さ計算
    let myHeight = 0;
    if (isLeaf) {
      // 1行
      myHeight = BOX_TOP_PADDING + 20;
    } else {
      const cCount = node.contacts.length;
      const contactAreaHeight =
        cCount * CONTACT_BOX_HEIGHT +
        (cCount > 0 ? (cCount - 1) * CONTACT_BOX_GAP : 0);
      myHeight = BOX_TOP_PADDING + contactAreaHeight;
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

    const fillColor = getColorByLevelAvg(node.contacts);

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
      fillColor,
    };
  }

  return computePos(root, 0, 0);
}

function createStepPath(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2;
  return `M${x1},${y1} H${midX} V${y2} H${x2}`;
}

/** contactLevel平均 → カラー */
function getColorByLevelAvg(contacts: Contact[]) {
  if (contacts.length === 0) return '#fff';
  const sum = contacts.reduce((acc, c) => acc + c.contactLevel, 0);
  const avg = Math.floor(sum / contacts.length);
  return getColorByLevel(avg);
}

/** 離散(0～5)で白→青 */
function getColorByLevel(level: number) {
  switch (level) {
    case 0: return '#ffffff';
    case 1: return '#cce0ff';
    case 2: return '#99c2ff';
    case 3: return '#66a3ff';
    case 4: return '#3385ff';
    case 5: return '#0033ff';
    default: return '#ffffff';
  }
}

function truncateContactLabel(c: Contact) {
  const full = `${c.lastName} ${c.firstName}`;
  return (full.length > 15) ? full.slice(0, 14) + '…' : full;
}

export default SalesHeatMapPage;