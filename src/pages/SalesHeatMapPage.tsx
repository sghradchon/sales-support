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
  useDisclosure,
  Input,
} from '@chakra-ui/react';
import { RxReset } from "react-icons/rx";
import { GripVertical } from 'lucide-react';

import { v4 as uuidv4 } from 'uuid';
// import activitiesData from "./activities.json";
// import opportunitiesData from './opportunities.json';
import ContactPage from "./ContactPage";


import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
const client = generateClient<Schema>();

const BOX_TOP_PADDING = 40;
const CONTACT_BOX_HEIGHT = 20;
const CONTACT_BOX_GAP = 5;

interface Organization {
  id: string;
  organizationName: string;
  upperLevelOrgId: string;
  siblingLevelOrgOrder: number;
  memo: string;
}

interface Contact {
  id: string;
  lastName: string;
  firstName: string;
  belongingOrgId: string;
  title: string;
  contactLevel: number;
  contactDescription: string;
  keyPerson: boolean;
}


interface Opportunity {
  id: string; //PK
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

//仮ーーーーーーーーーーーーーーーーーーーーーーーー
interface Activity {
  id: string; //PK
  contactId: string;
  activity: string;
}

export const castOrgAWSToInterface = (data: any[]) => {
  return data.map((item) => {
      return {
        id: item.id ?? '',
        organizationName: item.organizationName ?? '',
        upperLevelOrgId: item.upperLevelOrgId ?? '',
        siblingLevelOrgOrder: item.siblingLevelOrgOrder ?? 0,
        memo: item.memo ?? '',
      };
  });
};
export const castContactAWSToInterface = (data: any[]) => {
  return data.map((item) => {
      return {
        id: item.id ?? '',
        lastName: item.lastName ?? '',
        firstName: item.firstName ?? '',
        belongingOrgId: item.belongingOrgId ?? '',
        title: item.title ?? '',
        contactLevel: item.contactLevel ?? 0,
        contactDescription: item.contactDescription ?? '',
        keyPerson: item.keyPerson ?? false,
      };
    }
  );
};


export const castOpportunityAWSToInterface = (data: any[]): Opportunity[] => {
  return data.map((item) => {
    return {
      id:item.id??'',
      contactId: item.contactId ?? '',
      CustomerName: item.CustomerName ?? '',
      ProductName: item.ProductName ?? '',
      OpportunityName: item.OpportunityName ?? '',
      Distributor: item.Distributor ?? '',
      Application: item.Application ?? '',
      Territory: item.Territory ?? '',
      TargetPrice: item.TargetPrice ?? 0,
      CustomerBudget: item.CustomerBudget ?? 0,
      CompetitorPrice: item.CompetitorPrice ?? 0,
      CurrentStatus: item.CurrentStatus ?? '',
    };
  });
};

export const castActivityAWSToInterface = (data: any[]): Activity[] => {
  return data.map((item) => {
    return {
      id:item.id??'',
      contactId: item.contactId ?? '',
      activity: item.activity ?? '',
    };
  });
};

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
  | { type: 'org'; id: string }
  | { type: 'contact'; id: string }
  | null;

type DragOverMode = 'parent' | 'before' | 'after' | null;

// ---------------------------
const SalesHeatMapPage: React.FC = () => {
  const toast = useToast();

  // const [orgAws, setOrgAws] = useState<Schema["Organization"]["type"][]>([]);
  // const [contactAws,setContactAws] = useState<Schema["Contact"]["type"][]>([]);
  const [orgData, setOrgData] = useState<Organization[]>([]);
  const [contactData, setContactData] = useState<Contact[]>([]);
  

  const [opportunityData, setOpportunityData] = useState<Opportunity[]>([]);
  const [activityData, setActivityData] = useState<Activity[]>([]);

  
  const [positionedRoot, setPositionedRoot] = useState<PositionedNode | null>(null);
  const [positionedNewNodes, setPositionedNewNodes] = useState<PositionedNode[]>([]);
  
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
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactFirstName, setNewContactFirstName] = useState('');


  //
  // 1) データ読み込み
  //

  useEffect(() => {
    const loadData = async () => {
      try {
        
             // Amplify Data API から一覧取得
        const { data: orgRes, errors: orgErr } = await client.models.Organization.list();
        const { data: contactRes, errors: contErr } = await client.models.Contact.list();
        const { data: oppRes, errors: oppErr } = await client.models.Opportunity.list();
        const { data: actRes, errors: actErr } = await client.models.Activity.list();

        if (orgErr || contErr|| oppErr || actErr) {
          console.error(orgErr ?? contErr ?? oppErr ?? actErr);
          toast({ title:'Create error', status:'error'});

          // toast などで通知してもOK
          return;
        }
        // null→非null 変換
        const orgs = castOrgAWSToInterface(orgRes)
        const contacts = castContactAWSToInterface(contactRes)
        const opps = castOpportunityAWSToInterface(oppRes);
        const acts = castActivityAWSToInterface(actRes);

        setOrgData(orgs || []);
        setContactData(contacts || []);
        setOpportunityData(opps || [])
        setActivityData(acts || []);
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
  }, [orgData, contactData,opportunityData,activityData]);

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

  //
  // Contact更新
  //

  const updateContact = (updated: Contact) => {
    setContactData((prev) => 
      prev.map(c => 
        c.id === updated.id ? updated : c
      )
    );

    // toast
    toast({ title:'Updated locally (not saved)', status:'info' });
  };

  //
  // Organization更新
  
  function updateOrganization(updated: Organization) {
    // ローカル state だけ更新
    setOrgData((prev) => 
      prev.map(o => 
        o.id === updated.id ? updated : o
      )
    );

    // toast
    toast({ title:'Updated locally (not saved)', status:'info' });
  }

  // function updateOpportunity(updated: Opportunity) {
  //   setOpportunityData(prev =>
  //     prev.map(o => o.id === updated.id ? updated : o)
  //   );
  //   toast({ title:'Updated Opportunity locally', status:'info'});
  // }

  // function updateActivity(updated: Activity) {
  //   setActivityData(prev =>
  //     prev.map(a => a.id === updated.id ? updated : a)
  //   );
  //   toast({ title:'Updated Activity locally', status:'info'});
  // }

  //
  // 組織追加・削除・リセット
  //
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
      belongingOrgId: org.id, // rootに所属
      title: '',
      contactLevel: 0,
      contactDescription: '',
      keyPerson:false
    };
  
    setContactData([...contactData, newContact]);
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


  // function deleteOpportunity(oppId: string) {
  //   setOpportunityData(prev =>
  //     prev.filter(o => o.id !== oppId)
  //   );
  //   toast({ title:'Deleted Opportunity locally', status:'info'});
  // }


  async function saveAllChangesToAmplify() {
    try {
      // ============== 1) Organization 同期 ==============
      await syncLocalAndRemote<Organization>({
        localArray: orgData,
        listFn: client.models.Organization.list,
        createFn: client.models.Organization.create,
        updateFn: client.models.Organization.update,
        deleteFn: client.models.Organization.delete,
        castFn: castOrgAWSToInterface,
        isDifferentFn: isOrgDifferent,
        getPk: (org)=> org.id,
      });
      
      // ============== 2) Contact 同期 ==============
      await syncLocalAndRemote<Contact>({
        localArray: contactData,
        listFn: client.models.Contact.list,
        createFn: client.models.Contact.create,
        updateFn: client.models.Contact.update,
        deleteFn: client.models.Contact.delete,
        castFn: castContactAWSToInterface,
        isDifferentFn: isContactDifferent,
        getPk: (c)=> c.id,
      });
  
      // ============== 3) Opportunity 同期 ==============
      await syncLocalAndRemote<Opportunity>({
        localArray: opportunityData,
        listFn: client.models.Opportunity.list,   // AmplifyのOpportunity
        createFn: client.models.Opportunity.create,
        updateFn: client.models.Opportunity.update,
        deleteFn: client.models.Opportunity.delete,
        castFn: castOpportunityAWSToInterface,    // 下記で実装
        isDifferentFn: isOppDifferent,
        getPk: (o)=> o.id,
      });
  
      // ============== 4) Activity 同期 ==============
      await syncLocalAndRemote<Activity>({
        localArray: activityData,
        listFn: client.models.Activity.list,
        createFn: client.models.Activity.create,
        updateFn: client.models.Activity.update,
        deleteFn: client.models.Activity.delete,
        castFn: castActivityAWSToInterface,
        isDifferentFn: isActDifferent,
        getPk: (a)=> a.id,
      });
  
      toast({ title:'All changes saved!', status:'success'});
      
    } catch(e) {
      console.error(e);
      toast({ title:'saveAllChanges failed', status:'error'});
    }
  }

  interface SyncLocalRemoteArgs<T> {
    localArray: T[];
    listFn: ()=> Promise<{ data?: any, errors?: any }>;  // Amplify .list
    createFn: (payload: any)=> Promise<{ data?: any, errors?: any }>;
    updateFn: (payload: any)=> Promise<{ data?: any, errors?: any }>;
    deleteFn: (payload: any)=> Promise<{ data?: any, errors?: any }>;
    castFn: (items: any[])=> T[]; // AWS->Local
    isDifferentFn: (local: T, remote: any)=> boolean;
    getPk: (item: T)=> string; // PK extractor
  }
  
  async function syncLocalAndRemote<T>(args: SyncLocalRemoteArgs<T>) {
    const {
      localArray, listFn, createFn, updateFn, deleteFn,
      castFn, isDifferentFn, getPk
    } = args;
  
    // 1) list remote
    const { data: remoteRes, errors } = await listFn();
    if (errors || !remoteRes) {
      throw new Error('Failed to list remote data');
    }
    // cast
    const remoteItems = castFn(remoteRes|| []);
  
    // 2) map
    const localMap = new Map<string, T>();
    for (const l of localArray) {
      localMap.set(getPk(l), l);
    }
  
    const remoteMap = new Map<string, any>();
    for (const r of remoteItems) {
      remoteMap.set(getPk(r), r);
    }
  
    // A) create => localにあるが remoteに無い
    for (const [localPk, localObj] of localMap.entries()) {
      if (!remoteMap.has(localPk)) {
        // create
        const payload = { ...localObj };
        // payloadに "id" があるならOK. すべて Amplifyに渡したいフィールドをspread
        const { data: _, errors } = await createFn(payload);
        if (errors) {
          // continue
        }
      }
    }
  
    // B) update => 両方にあり diff
    for (const [localPk, localObj] of localMap.entries()) {
      const remoteObj = remoteMap.get(localPk);
      if (remoteObj) {
        if (isDifferentFn(localObj, remoteObj)) {
          const payload = { ...localObj };
          const { data: _, errors } = await updateFn(payload);
          if (errors) {
            console.error(errors);
          }
        }
      }
    }
  
    // C) delete => remoteにあるが localに無い
    for (const [remPk, _] of remoteMap.entries()) {
      if (!localMap.has(remPk)) {
        const payload = { id: remPk }; // PK
        const { data: _, errors } = await deleteFn(payload);
        if (errors) {
          console.error(errors);
        }
      }
    }
  
    // 仕上げ: 返り値は  “最終的に list した remote items” か？
    // ここでは "何もしない"。上位で再取得するならそれでもOK
  }
  
  // ヘルパー
  function isOrgDifferent(localObj: Organization, remoteObj: any) {
    if (localObj.organizationName !== remoteObj.organizationName) return true;
    if (localObj.upperLevelOrgId !== remoteObj.upperLevelOrgId) return true;
    if (localObj.siblingLevelOrgOrder !== remoteObj.siblingLevelOrgOrder) return true;
    if (localObj.memo !== remoteObj.memo) return true;
    return false;
  }

  function isContactDifferent(localC: Contact, remoteC: any): boolean {
    if (localC.lastName !== remoteC.lastName) return true;
    if (localC.firstName !== remoteC.firstName) return true;
    if (localC.belongingOrgId !== remoteC.belongingOrgId) return true;
    if (localC.title !== remoteC.title) return true;
    if (localC.contactLevel !== remoteC.contactLevel) return true;
    if (localC.contactDescription !== remoteC.contactDescription) return true;
    return false;
  }

  function isOppDifferent(localO: Opportunity, remoteO: any): boolean {
    if (localO.contactId !== remoteO.contactId) return true;
    if (localO.CustomerName !== remoteO.CustomerName) return true;
    if (localO.ProductName !== remoteO.ProductName) return true;
    if (localO.OpportunityName !== remoteO.OpportunityName) return true;
    if (localO.Distributor !== remoteO.Distributor) return true;
    if (localO.Application !== remoteO.Application) return true;
    if (localO.Territory !== remoteO.Territory) return true;
    if (localO.TargetPrice !== remoteO.TargetPrice) return true;
    if (localO.CustomerBudget !== remoteO.CustomerBudget) return true;
    if (localO.CompetitorPrice !== remoteO.CompetitorPrice) return true;
    if (localO.CurrentStatus !== remoteO.CurrentStatus) return true;
    return false;
  }
  
  function isActDifferent(localA: Activity, remoteA: any): boolean {
    if (localA.contactId !== remoteA.contactId) return true;
    if (localA.activity !== remoteA.activity) return true;
    return false;
  }

  async function handleResetData() {
    try {
      // 1) Org
      const { data: orgRes, errors: orgErr } = await client.models.Organization.list();
      if (orgErr) { throw new Error('org list error'); }
      setOrgData(castOrgAWSToInterface(orgRes || []));
  
      // 2) Contact
      const { data: contRes, errors: contErr } = await client.models.Contact.list();
      if (contErr) { throw new Error('contact list error'); }
      setContactData(castContactAWSToInterface(contRes || []));
  
      // 3) Opportunity
      const { data: oppRes, errors: oppErr } = await client.models.Opportunity.list();
      if (oppErr) { throw new Error('opp list error'); }
      setOpportunityData(castOpportunityAWSToInterface(oppRes || []));
  
      // 4) Activity
      const { data: actRes, errors: actErr } = await client.models.Activity.list();
      if (actErr) { throw new Error('act list error'); }
      setActivityData(castActivityAWSToInterface(actRes || []));
  
      toast({ title:'Reset to DB data done', status:'info'});
    } catch(e) {
      console.error(e);
      toast({ title:'resetAllData failed', status:'error'});
    }
  }
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
      return;//pan無効
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

  // const onSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
  //   e.preventDefault();
  //   const zoomFactor = 0.1;
  //   if (e.deltaY < 0) {
  //     setScale((prev) => Math.min(prev + zoomFactor, 5));
  //   } else {
  //     setScale((prev) => Math.max(prev - zoomFactor, 0.2));
  //   }
  // };

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


  function isDescendant(root: PositionedNode, potentialAncestorId: string, checkId: string): boolean {
    // 1) potentialAncestorId のノードを探す
    const ancestorNode = findPositionedNode(root, potentialAncestorId);
    if (!ancestorNode) return false; // そもそも見つからないなら false
  
    // 2) ancestorNode のサブツリー内に checkId がいるか
    return hasNode(ancestorNode, checkId);
  }
  
  // 再帰的にサブツリー内に orgId が含まれるかをチェック
  function hasNode(node: PositionedNode, targetOrgId: string): boolean {
    if (node.org.id === targetOrgId) return true;
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
      return node.org.id;
    }
    for (const child of node.children) {
      const found = findOrgNodeAt(child, x, y, margin);
      if (found) return found;
    }
    return null;
  }

  function findPositionedNode(node: PositionedNode, orgId: string): PositionedNode | null {
    if (node.org.id === orgId) return node;
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
      orgMap[o.id] = { org: o, children: [], contacts: [] };
    });
    sorted.forEach((o) => {
      if (o.upperLevelOrgId && orgMap[o.upperLevelOrgId]) {
        orgMap[o.upperLevelOrgId].children.push(orgMap[o.id]);
      }
    });

    let root: OrgTreeNode | undefined;
    for (const o of sorted) {
      if (!o.upperLevelOrgId || !orgMap[o.upperLevelOrgId]) {
        root = orgMap[o.id];
        break;
      }
    }

    contacts.forEach((c) => {
      if (orgMap[c.belongingOrgId]) {
        orgMap[c.belongingOrgId].contacts.push(c);
      }
    });
    if (!root) {
      root = orgMap[sorted[0].id];
    }
    return root;
  }

  function layoutOrgTree(root: OrgTreeNode): PositionedNode {
    const horizontalGap = 180;
    const verticalGap = 40;
    const paddingX = 0;


    function computePos(node: OrgTreeNode, startX: number, startY: number): PositionedNode {
      const isLeaf = (node.children.length === 0);
      let boxWidth = 150;
      if (isLeaf && node.contacts.length > 0) {
        const contactWidths = node.contacts.map((contact) => {
          const label = truncateContactLabel(contact);
          return measureTextWidth(label) + paddingX * 2;
        });
        const totalWidth = contactWidths.reduce((sum, w) => sum + w, 0);
        const totalGapWidth = (node.contacts.length - 1) * 15;
        boxWidth = Math.max(150, totalWidth + totalGapWidth + 50);
      }


      let myHeight = BOX_TOP_PADDING + 20;
      if (!isLeaf) {
        const cCount = node.contacts.length;
        const contactArea = cCount * CONTACT_BOX_HEIGHT + (cCount > 0 ? (cCount - 1) * CONTACT_BOX_GAP : 0);
        myHeight = Math.max(myHeight, BOX_TOP_PADDING + contactArea);
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
      <React.Fragment key={node.org.id}>
        {connectionPath && (
          <path d={connectionPath} stroke="#666" fill="none" strokeWidth={2} />
        )}
        {renderOrgBox(node)}
        {node.children.map((child) => renderTree(child, node))}
      </React.Fragment>
    );
  }

  function layoutNewNodes(newOrgs: Organization[]): PositionedNode[] {
    // 単純に "1ノード = 1小BOX" を横or縦に並べる例
    // ここでは "y=someFixed" で同じ高さに並べ、
    //   x をずらして配置する
  
    const nodeWidth = 120, nodeHeight = 50;
    const gap = 20;
    let currentX = 0;
    let currentY = 250; // 例えば mainツリーの下あたり
    
    const result: PositionedNode[] = [];
    
    for (const org of newOrgs) {
      const pNode: PositionedNode = {
        org,
        x: currentX,
        y: currentY,
        width: nodeWidth,
        height: nodeHeight,
        contacts: [],       // NEWノードなので contact表示しない or 別途調整
        children: [],
        subtreeMinY: currentY,
        subtreeMaxY: currentY + nodeHeight,
        fillColor: '#ffe',  // 適当
      };
      result.push(pNode);
  
      currentX += nodeWidth + gap;
    }
    return result;
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

  

  //
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

  //
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

  //
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

  // 指定の contactId に対して、opportunity があるかチェックする
  function contactHasOpportunity(contactId: string): boolean {
    return opportunityData.filter((opp: { contactId: string }) => opp.contactId === contactId).length > 0;
  }

  // 各 contactId に紐づく activities の数を返す関数
  function getActivityCount(contactId: string): number {
    return activityData.filter((act: { contactId: string }) => act.contactId === contactId).length;
  }

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
      <Button colorScheme="blue" onClick={saveAllChangesToAmplify} mr={4}>
        SAVE
      </Button>
      <Button onClick={handleZoomIn} mr={1} w="30px" h="30px" borderRadius="full">＋</Button>
        <Button onClick={handleZoomOut}　mr={1} w="30px" h="30px" borderRadius="full">－</Button>

        <Box onClick={handleResetData} cursor="pointer">
                  <RxReset />
        </Box>
        
      </Box>
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
  if (full.length > 8) {
    return full.slice(0, 7) + '…';
  }
  return full;
}

const measureTextWidth = (text: string, fontSize = 12, fontFamily = 'Arial'): number => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context!.font = `${fontSize}px ${fontFamily}`;
  return context!.measureText(text).width;
};


//
// エクスポート
//
export default SalesHeatMapPage;