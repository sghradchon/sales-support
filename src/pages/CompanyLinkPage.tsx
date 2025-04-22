import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  useToast,
  Select
} from '@chakra-ui/react';
import { RxReset } from "react-icons/rx";
import { v4 as uuidv4 } from 'uuid';

import CompanyComponent from './CompanyComponent';

import {
  loadAllDataFromAmplify,
  loadAllDataFromLocalJSON,
  saveAllDataToAmplify,
  saveAllDataToLocalJSON
} from './DataService';

import {
  Company,
  CompanyMap,
  OrgByCompanyMap,
  Organization,
  Contact,
  ContactByCompanyMap,
  Opportunity,
  Activity,
  createContactByCompany,
  getContactsByTheCompany
} from "./TypesAndUtils";

interface CompanyNode {
  id: string;
  company: Company;
  x: number;
  y: number;
}
interface Frame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Edge {
  id: string;
  fromId: string;
  toId: string;
}

const SNAP_SIZE = 10;

const CompanyLinkPage: React.FC = () => {
  const toast = useToast();

  // (A) Amplify / Localデータ
  const [companyData, setCompanyData] = useState<Company[]>([]);
  const [orgData, setOrgData] = useState<Organization[]>([]);
  const [contactData, setContactData] = useState<Contact[]>([]);
  const [opportunityData, setOpportunityData] = useState<Opportunity[]>([]);
  const [activityData, setActivityData] = useState<Activity[]>([]);

  const [companyMap, setCompanyMap] = useState<CompanyMap>({});
  const [orgByCompany, setOrgByCompany] = useState<OrgByCompanyMap>({});
  const [contactByCompany, setContactByCompany] = useState<ContactByCompanyMap>({});

  const [dataMode, setDataMode] = useState<'amplify' | 'local'>('amplify');

  // (B) ノード管理
  const [companyNodes, setCompanyNodes] = useState<CompanyNode[]>([]);
  const displayedCompanyIds = companyNodes.map(n => n.company.id);
  const [selectedCompanyIdForNode, setSelectedCompanyIdForNode] = useState('');

  // (C) フレーム管理
  const [frames, setFrames] = useState<Frame[]>([]);

  // (D) ドラッグ状態
  const [dragType, setDragType] = useState<DragType>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // (E) Companyモーダル
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // (F) Edges (線)
  const [edges, setEdges] = useState<Edge[]>([]);

  // ========== 追加: Edgeドラッグ用 状態 ==========
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const [edgeX, setEdgeX] = useState(0);   // マウス座標(仮線の終点)
  const [edgeY, setEdgeY] = useState(0);   // マウス座標(仮線の終点)

  // ---------------------
  // 1) データロード
  // ---------------------
  useEffect(() => {
    handleLoadAll();
    // eslint-disable-next-line
  }, [dataMode]);

  const handleLoadAll = async () => {
    try {
      if (dataMode === 'amplify') {
        const { companies, orgs, contacts, opportunities, activities } = await loadAllDataFromAmplify();
        setCompanyData(companies);
        setOrgData(orgs);
        setContactData(contacts);
        setOpportunityData(opportunities);
        setActivityData(activities);
      } else {
        const { companies, orgs, contacts, opportunities, activities } = await loadAllDataFromLocalJSON();
        setCompanyData(companies);
        setOrgData(orgs);
        setContactData(contacts);
        setOpportunityData(opportunities);
        setActivityData(activities);
      }
      toast({ title: `Data loaded from ${dataMode}`, status: 'success' });
    } catch (err) {
      console.error(err);
      toast({ title: `Load data failed (${dataMode})`, status: 'error' });
    }
  };

  // 2) Org/Contact セット
  useEffect(() => {
    const cmpMap: CompanyMap = companyData.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {} as CompanyMap);
    setCompanyMap(cmpMap);

    const companyIds = companyData.map(c => c.id);
    const newOrgMap: OrgByCompanyMap = companyIds.reduce((acc, cid) => {
      acc[cid] = orgData.filter(o => o.companyId === cid);
      return acc;
    }, {} as OrgByCompanyMap);
    setOrgByCompany(newOrgMap);

    const newContactMap: ContactByCompanyMap = createContactByCompany(companyData, orgData, contactData);
    setContactByCompany(newContactMap);
  }, [companyData, orgData, contactData]);

  // 3) setter
  function updateOrgDataForCompany(companyId: string, partial: Organization[] | ((p: Organization[]) => Organization[])) {
    setOrgData((prev) => {
      const subset = prev.filter(o => o.companyId === companyId);
      const newSubset = (typeof partial === 'function') ? partial(subset) : partial;
      const others = prev.filter(o => o.companyId !== companyId);
      return [...others, ...newSubset];
    });
  }
  function updateContactDataForCompany(companyId: string, partial: Contact[] | ((p: Contact[]) => Contact[])) {
    setContactData((prev) => {
      const subset = getContactsByTheCompany(prev, orgData, companyId);
      const newSubset = (typeof partial === 'function') ? partial(subset) : partial;
      const others = prev.filter(o => !subset.includes(o));
      return [...others, ...newSubset];
    });
  }

  // 4) SAVE
  const handleSaveAll = async () => {
    if (dataMode === 'amplify') {
      try {
        await saveAllDataToAmplify(
          companyData, orgData, contactData, opportunityData, activityData
        );
        toast({ title: 'All changes saved to Amplify!', status: 'success' });
      } catch(e) {
        console.error(e);
        toast({ title: 'saveAllChanges failed', status: 'error' });
      }
    } else {
      saveAllDataToLocalJSON(companyData, orgData, contactData, opportunityData, activityData);
      toast({ title: 'Saved to local JSON (download)', status: 'success' });
    }
  };

  // 5) リセット
  const handleResetData = async () => {
    await handleLoadAll();
    toast({ title: `Reset to ${dataMode} data done`, status: 'info' });
  };

  // ---------------------------
  // 会社ノード追加
  // ---------------------------

  const unplacedCompanies = companyData.filter((c) => !displayedCompanyIds.includes(c.id));

  const handleAddCompanyNode = () => {
    if (!selectedCompanyIdForNode) return;

    if (selectedCompanyIdForNode === 'ALL') {
      // すべて追加
      const newNodes = unplacedCompanies.map((cmp) => ({
        id: cmp.id,
        company: cmp,
        x: 50,
        y: 50
      }));
      setCompanyNodes((prev) => [...prev, ...newNodes]);
      setSelectedCompanyIdForNode('');
      return;
    }

    // 1社追加
    const target = companyData.find((c) => c.id === selectedCompanyIdForNode);
    if (!target) return;
    const newNode: CompanyNode = {
      id: target.id,
      company: target,
      x: 50,
      y: 50,
    };
    setCompanyNodes((prev) => [...prev, newNode]);
    setSelectedCompanyIdForNode('');
  };

  // ---------------------------
  // フレーム追加・削除
  // ---------------------------

  const handleAddFrame = () => {
    const newF: Frame = {
      id: uuidv4(),
      x: 100,
      y: 100,
      width: 120,
      height: 80,
    };
    setFrames((prev) => [...prev, newF]);
  };
  const handleDeleteFrame = (frameId: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== frameId));
  };

  // ---------------------------
  // Edges(線)
  // ---------------------------

  // ノードの中心を取得 (ノード幅:200px,高さ:100pxと仮定)
  function getNodeCenter(node: CompanyNode) {
    const w = 200; 
    const h = 100;
    return {
      cx: node.x + w/2,
      cy: node.y + h/2
    };
  }

  // ★ドラッグ中の仮線 & 既存のEdgeをまとめて描画
  function renderEdges() {
    return (
      <>
        {/* 既存Edges */}
        {edges.map((edge) => {
          const fromNode = companyNodes.find(n => n.id === edge.fromId);
          const toNode = companyNodes.find(n => n.id === edge.toId);
          if (!fromNode || !toNode) return null;

          const {cx:x1, cy:y1} = getNodeCenter(fromNode);
          const {cx:x2, cy:y2} = getNodeCenter(toNode);
          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="black"
              strokeWidth={2}
            />
          );
        })}

        {/* 仮線: dragType==='edge' のときだけ描画 */}
        {dragType==='edge' && edgeSourceId && (
          (() => {
            const srcNode = companyNodes.find(n => n.id === edgeSourceId);
            if (!srcNode) return null;
            const {cx, cy} = getNodeCenter(srcNode);

            return (
              <line
                x1={cx}
                y1={cy}
                x2={edgeX}
                y2={edgeY}
                stroke="gray"
                strokeDasharray="5,5"
                strokeWidth={2}
              />
            );
          })()
        )}
      </>
    );
  }

  // ---------------------------
  // ドラッグ処理
  // ---------------------------
  type DragType = 'node' | 'frame' | 'frame-resize' | 'edge' | null;

  // ノードドラッグ開始(左上のハンドル)
  const handleNodeDragHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    e.stopPropagation();
    setDragType('node');
    setDragId(nodeId);
  };

  // Edgeドラッグ開始(右端中央のハンドル)
  const handleEdgeHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    e.stopPropagation();
    setDragType('edge');
    setEdgeSourceId(nodeId);
  };

  // ノードクリック (本体) => モーダル or Edge確定
  const handleNodeClick = (nodeId: string) => {
    // Edge ドラッグが終了したタイミング → pointerUpで処理する
    // ここでは 余計なキャンセルをしない
    // もし dragType==='edge' なら pointerUpでハンドル => finalizeEdge
    // → そうすると handlePointerUp にロジック書くか？

    // ここでは "通常のモーダル" だけ
    const node = companyNodes.find(n => n.id===nodeId);
    if (!node) return;
    setSelectedCompany(node.company);
    onOpen();
  };

  // フレームドラッグ開始
  const handleFramePointerDown = (e: React.PointerEvent<HTMLDivElement>, frameId: string) => {
    e.stopPropagation();
    setDragType('frame');
    setDragId(frameId);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffsetX(e.clientX - rect.left);
    setDragOffsetY(e.clientY - rect.top);
  };

  // フレームリサイズ開始
  const handleFrameCornerPointerDown = (e: React.PointerEvent<HTMLDivElement>, frameId: string) => {
    e.stopPropagation();
    setDragType('frame-resize');
    setDragId(frameId);
    const f = frames.find(fr => fr.id===frameId);
    if (!f) return;
    setOriginalWidth(f.width);
    setOriginalHeight(f.height);
    setDragOffsetX(e.clientX);
    setDragOffsetY(e.clientY);
  };

  // PointerMove
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragType) return;
    e.preventDefault();

    if (dragType==='node') {
      if (!dragId) return;
      setCompanyNodes(prev => prev.map(n => {
        if (n.id===dragId) {
          return {
            ...n,
            x: snapToGrid(n.x + e.movementX),
            y: snapToGrid(n.y + e.movementY),
          };
        }
        return n;
      }));
    } else if (dragType==='frame') {
      if (!dragId) return;
      setFrames(prev => prev.map(fr => {
        if (fr.id===dragId) {
          return {
            ...fr,
            x: snapToGrid(fr.x + e.movementX),
            y: snapToGrid(fr.y + e.movementY),
          };
        }
        return fr;
      }));
    } else if (dragType==='frame-resize') {
      if (!dragId) return;
      setFrames(prev => prev.map(fr => {
        if (fr.id===dragId) {
          const dx = e.clientX - dragOffsetX;
          const dy = e.clientY - dragOffsetY;
          const newW = snapToGrid(originalWidth + dx);
          const newH = snapToGrid(originalHeight + dy);
          return {
            ...fr,
            width: newW<20?20:newW,
            height: newH<20?20:newH
          };
        }
        return fr;
      }));
    } else if (dragType==='edge') {
      // Edgeドラッグ: pointerの位置を保存 -> 仮線を描く
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setEdgeX(px);
      setEdgeY(py);
    }
  };

  // PointerUp
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    // エッジドラッグ中なら => もしpointerUp先が他ノードなら edge確定
    if (dragType==='edge' && edgeSourceId) {
      // 他ノードの上なのか判定 => node center?
      // 簡易的には getBoundingClientRect で判定 or
      // もう一度 "node clicked"?
      // → ここでは "nodeにonClick => finalizeEdge" ではなく 
      // pointerUp位置でノードかどうかを計算するか
      const targetNodeId = findNodeAtPosition(e.clientX, e.clientY);
      if (targetNodeId && targetNodeId!==edgeSourceId) {
        // Edge確定
        setEdges(prev => [
          ...prev,
          { id: uuidv4(), fromId: edgeSourceId, toId: targetNodeId }
        ]);
        toast({ title: 'ノードを接続しました (Drag)', status:'success' });
      } else {
        // 何もない or 同じnode => キャンセル
      }
    }

    // リセット
    setDragType(null);
    setDragId(null);
    setEdgeSourceId(null);
  };

  // 現在のpointerUp位置がどのnodeか判定する例
  // "nodeの絶対座標" vs pointerUp絶対座標 => 当たってるか
  function findNodeAtPosition(clientX: number, clientY: number): string | null {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    // CompanyNode の "width=200 / height=100" で当たり判定
    for (const n of companyNodes) {
      const x1 = n.x;
      const y1 = n.y;
      const x2 = x1 + 200;
      const y2 = y1 + 100;
      if (offsetX >= x1 && offsetX <= x2 && offsetY >= y1 && offsetY <= y2) {
        return n.id;
      }
    }
    return null;
  }

  function snapToGrid(val: number) {
    return Math.round(val / SNAP_SIZE)*SNAP_SIZE;
  }

  return (
    <Box>
      {/* 上部: DataMode, Save, Reset */}
      <Box mb={2} display="flex" alignItems="center">
        <Select
          width="150px"
          value={dataMode}
          onChange={(e) => setDataMode(e.target.value as 'amplify' | 'local')}
          mr={4}
        >
          <option value="amplify">Amplify</option>
          <option value="local">Local JSON</option>
        </Select>
        <Button colorScheme="blue" onClick={handleSaveAll} mr={4}>
          SAVE
        </Button>
        <Box onClick={handleResetData} cursor="pointer" mr={4}>
          <RxReset />
        </Box>
      </Box>

      {/* 会社ノード追加 */}
      <Box mb={2} display="flex" alignItems="center">
        <Select
          placeholder="会社を選択"
          width="200px"
          value={selectedCompanyIdForNode}
          onChange={(e) => setSelectedCompanyIdForNode(e.target.value)}
          mr={2}
        >
          <option value="ALL">すべて</option>
          {companyData.filter(c => !displayedCompanyIds.includes(c.id)).map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
        <Button onClick={handleAddCompanyNode}>ノード追加</Button>
      </Box>

      {/* フレーム追加 */}
      <Button onClick={handleAddFrame} mr={2}>
        フレームを追加
      </Button>

      {/* キャンバス */}
      <Box
        ref={containerRef}
        position="relative"
        width="100vw"
        height="80vh"
        bg="#eee"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* 背面SVG: Edge描画 */}
        <svg
          width="100%"
          height="100%"
          style={{ position:'absolute', top:0, left:0, pointerEvents:'none',zIndex: 1 }}
        >
          {renderEdges()}
        </svg>

        {/* フレーム */}
        {frames.map((fr) => (
          <Box
            key={fr.id}
            position="absolute"
            left={`${fr.x}px`}
            top={`${fr.y}px`}
            width={`${fr.width}px`}
            height={`${fr.height}px`}
            bg="white"
            border="2px solid #444"
            onPointerDown={(e) => handleFramePointerDown(e, fr.id)}
            zIndex={0} // SVGより前、ノードより後ろ
          >
            <Box
              position="absolute"
              right="0"
              bottom="0"
              width="16px"
              height="16px"
              bg="blue.400"
              cursor="nwse-resize"
              onPointerDown={(e) => handleFrameCornerPointerDown(e, fr.id)}
            />
            <Button
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFrame(fr.id);
              }}
            >
              削除
            </Button>
          </Box>
        ))}

        {/* Companyノード */}
        {companyNodes.map((node) => (
          <Box
            key={node.id}
            position="absolute"
            left={`${node.x}px`}
            top={`${node.y}px`}
            width="200px"
            height="100px"
            bg="white"
            border="1px solid #333"
            borderRadius="8px"
            userSelect="none"
            zIndex={2} // 最前面
          >
            {/* ノード本体クリック => モーダル or Edge確定 */}
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              onClick={() => handleNodeClick(node.id)}
              cursor="pointer"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {node.company.companyName}
            </Box>

            {/* ドラッグハンドル (左上) */}
            <Box
              position="absolute"
              left="0"
              top="0"
              width="24px"
              height="24px"
              bg="gray.300"
              cursor="grab"
              onPointerDown={(e) => handleNodeDragHandlePointerDown(e, node.id)}
            />

            {/* エッジ用ハンドル (右端中央) */}
            <Box
              position="absolute"
              right="0"
              top="50%"
              transform="translateY(-50%)"
              width="24px"
              height="24px"
              bg="orange.300"
              borderRadius="50%"   // 丸くする
              cursor="crosshair"
              onPointerDown={(e) => {
                handleEdgeHandlePointerDown(e,node.id)

                // いったん仮線の終点をnode中心に
                const {cx, cy} = getNodeCenter(node);
                setEdgeX(cx);
                setEdgeY(cy);
              }}
            />
          </Box>
        ))}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay/>
        <ModalContent width="auto" maxW="fit-content" maxH="fit-content">
          <ModalHeader>Company詳細</ModalHeader>
          <ModalCloseButton/>
          <ModalBody>
            {selectedCompany && (
              <CompanyComponent
                company={selectedCompany}
                orgData={orgByCompany[selectedCompany.id]||[]}
                contactData={contactByCompany[selectedCompany.id]||[]}
                opportunityData={opportunityData}
                activityData={activityData}
                setOrgData={(upd)=>
                  updateOrgDataForCompany(selectedCompany.id,upd)
                }
                setContactData={(upd)=>
                  updateContactDataForCompany(selectedCompany.id,upd)
                }
                setOpportunityData={setOpportunityData}
                setActivityData={setActivityData}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>閉じる</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default CompanyLinkPage;