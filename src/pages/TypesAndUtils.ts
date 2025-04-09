
// Types.ts

export interface Company {
    id: string;
    companyName: string;
    upperLevelCompanyId: string;
    memo: string;
  }

  export interface CompanyMap {
    [companyId:string]:Company
  }
  
  export interface Organization {
    id: string;
    organizationName: string;
    upperLevelOrgId: string;
    siblingLevelOrgOrder: number;
    companyId: string;
    memo: string;
  }
  
  export interface OrgByCompanyMap {
    [companyId: string]: Organization[];
  }

  export interface ContactByCompanyMap {
    [companiId:string]:Contact[]
  }
  
  export interface Contact {
    id: string;
    lastName: string;
    firstName: string;
    belongingOrgId: string;
    title: string;
    contactLevel: number;
    contactDescription: string;
    keyPerson: boolean;
    siblingOrder: number;
    hobby: string;
    familyMember: string;
    previousCareer: string;
    speciality: string;
    alcoholPreference: string;
    foodPreference: string;
  }



  export interface Opportunity {
    id: string; // PK
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
    ScheduleSpec: string;
    ScheduleQuote: string;
    ScheduleOrder: string;
    ScheduleDelivery: string;
    CustomerProductImage: string;
    OpportunityStage: string;
    CurrentStatus: string;
  }
  
  export interface Activity {
    id: string; //PK
    activityDate:string;
    contactId: string;
    content: string;
    todoDate:string;
    todo:string
  }

  // ContactByCompanyを間接的に作る関数
  export const createContactByCompany = (
    companies: Company[],
    organizations: Organization[],
    contacts: Contact[]
  ): ContactByCompanyMap => {
    
    // OrganizationからcompanyIdをマッピングする
    const orgToCompanyMap: Record<string, string> = organizations.reduce((acc, org) => {
      acc[org.id] = org.companyId;
      return acc;
    }, {} as Record<string, string>);

    // 会社ごとのContactをまとめる
    const contactByCompany: ContactByCompanyMap = companies.reduce((acc, company) => {
      acc[company.id] = contacts.filter(contact => {
        const orgId = contact.belongingOrgId;
        const compId = orgToCompanyMap[orgId];
        return compId === company.id;
      });
      return acc;
    }, {} as ContactByCompanyMap);

    return contactByCompany;
  };


  export const getContactsByTheCompany = (
    contacts: Contact[],
    organizations: Organization[],
    companyId: string
  ): Contact[] => {
    ///contactId指定でContact[]を取り出す
    const orgIds = organizations
      .filter(org => org.companyId === companyId)
      .map(org => org.id);
  
    return contacts.filter(contact => orgIds.includes(contact.belongingOrgId));
  };

  
  export const castCompanyAWSToInterface = (data: any[]) => {
    return data.map((item) => {
        return {
          id: item.id ?? '',
          companyName: item.companyName ?? '',
          upperLevelCompanyId: item.upperLevelCompanyId ?? '',
          memo: item.memo ?? '',
        };
    });
  };
  export const castOrgAWSToInterface = (data: any[]) => {
    return data.map((item) => {
        return {
          id: item.id ?? '',
          organizationName: item.organizationName ?? '',
          upperLevelOrgId: item.upperLevelOrgId ?? '',
          siblingLevelOrgOrder: item.siblingLevelOrgOrder ?? 0,
          companyId:item.companyId??'',
          memo: item.memo ?? '',
        };
    });
  };

  export const castContactAWSToInterface = (data: any[]): Contact[] => {
    return data.map((item) => ({
      id: item.id ?? '',
      lastName: item.lastName ?? '',
      firstName: item.firstName ?? '',
      belongingOrgId: item.organizationId ?? '',
      title: item.title ?? '',
      contactLevel: item.contactLevel ?? 0,
      contactDescription: item.contactDescription ?? '',
      keyPerson: item.keyPerson ?? false,
      siblingOrder: Number(item.siblingOrder) ?? 0,
      hobby: item.hobby ?? '',
      familyMember: item.familyMember ?? '',
      previousCareer: item.previousCareer ?? '',
      speciality: item.speciality ?? '',
      alcoholPreference: item.alcoholPreference ?? '',
      foodPreference: item.foodPreference ?? ''
    }));
  };

  export const castOpportunityAWSToInterface = (data: any[]): Opportunity[] => {
    return data.map((item) => ({
      id: item.Id ?? '',
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
      ScheduleSpec: item.ScheduleSpec ?? '',
      ScheduleQuote: item.ScheduleQuote ?? '',
      ScheduleOrder: item.ScheduleOrder ?? '',
      ScheduleDelivery: item.ScheduleDelivery ?? '',
      CustomerProductImage: item.CustomerProductImage ?? '',
      OpportunityStage: item.OpportunityStage ?? '',
      CurrentStatus: item.CurrentStatus ?? '',
    }));
  };

  export const castActivityAWSToInterface = (data: any[]): Activity[] => {
    return data.map((item) => ({
      id: item.id ?? '',
      contactId: item.contactId ?? '',
      activityDate:item.activityDate ?? '',
      content: item.content ?? '',
      todoDate: item.todoDate ?? '',
      todo: item.todo ?? '',
    }));
  };
  

  export async function syncLocalAndRemote<T>(args: SyncLocalRemoteArgs<T>) {
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

  export interface SyncLocalRemoteArgs<T> {
    localArray: T[];
    listFn: ()=> Promise<{ data?: any, errors?: any }>;  // Amplify .list
    createFn: (payload: any)=> Promise<{ data?: any, errors?: any }>;
    updateFn: (payload: any)=> Promise<{ data?: any, errors?: any }>;
    deleteFn: (payload: any)=> Promise<{ data?: any, errors?: any }>;
    castFn: (items: any[])=> T[]; // AWS->Local
    isDifferentFn: (local: T, remote: any)=> boolean;
    getPk: (item: T)=> string; // PK extractor
  }


  export function isCompanyDifferent(localObj: Company, remoteObj: any) {
      if (localObj.companyName !== remoteObj.companyName) return true;
      if (localObj.upperLevelCompanyId !== remoteObj.upperLevelCompanyId) return true;
      if (localObj.memo !== remoteObj.memo) return true;
      return false;
    }
  
  export function isOrgDifferent(localObj: Organization, remoteObj: any) {
      if (localObj.organizationName !== remoteObj.organizationName) return true;
      if (localObj.upperLevelOrgId !== remoteObj.upperLevelOrgId) return true;
      if (localObj.siblingLevelOrgOrder !== Number(remoteObj.siblingLevelOrgOrder)) return true;
      if (localObj.companyId !== remoteObj.companyId) return true;
      if (localObj.memo !== remoteObj.memo) return true;
      return false;
    }
  export function isContactDifferent(localC: Contact, remoteC: any): boolean {
    if (localC.lastName !== remoteC.lastName) return true;
    if (localC.firstName !== remoteC.firstName) return true;
    if (localC.belongingOrgId !== remoteC.belongingOrgId) return true;
    if (localC.title !== remoteC.title) return true;
    if (localC.contactLevel !== remoteC.contactLevel) return true;
    if (localC.contactDescription !== remoteC.contactDescription) return true;
    if (localC.keyPerson !== remoteC.keyPerson) return true;
    if (localC.siblingOrder !== Number(remoteC.siblingOrder)) return true;
    if (localC.hobby !== remoteC.hobby) return true;
    if (localC.familyMember !== remoteC.familyMember) return true;
    if (localC.previousCareer !== remoteC.previousCareer) return true;
    if (localC.speciality !== remoteC.speciality) return true;
    if (localC.alcoholPreference !== remoteC.alcoholPreference) return true;
    if (localC.foodPreference !== remoteC.foodPreference) return true;
    return false;
  }
      
    export function isOppDifferent(localO: Opportunity, remoteO: any): boolean {
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
      if (localO.ScheduleSpec !== remoteO.ScheduleSpec) return true; // 追加
      if (localO.ScheduleQuote !== remoteO.ScheduleQuote) return true; // 追加
      if (localO.ScheduleOrder !== remoteO.ScheduleOrder) return true; // 追加
      if (localO.ScheduleDelivery !== remoteO.ScheduleDelivery) return true; // 追加
      if (localO.CustomerProductImage !== remoteO.CustomerProductImage) return true; // 追加
      if (localO.OpportunityStage !== remoteO.OpportunityStage) return true; // 追加
      if (localO.CurrentStatus !== remoteO.CurrentStatus) return true;
      return false;
    }
    
    export function isActDifferent(localA: Activity, remoteA: any): boolean {
      if (localA.contactId !== remoteA.contactId) return true;
      if (localA.activityDate !== remoteA.activityDate) return true; // 修正: activity→content
      if (localA.content !== remoteA.content) return true; // 修正: activity→content
      if (localA.todoDate !== remoteA.todoDate) return true; // 追加
      if (localA.todo !== remoteA.todo) return true; // 追加
      return false;
    }


 export interface OrgTreeNode {
    org: Organization;
    children: OrgTreeNode[];
    contacts: Contact[];
  }
  

export interface PositionedNode {
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


const BOX_TOP_PADDING = 40;
const CONTACT_BOX_HEIGHT = 20;
const CONTACT_BOX_GAP = 5;


export function buildOrgTree(orgs: Organization[], contacts: Contact[]): OrgTreeNode {

  const sorted = [...orgs].sort(
    (a, b) => a.siblingLevelOrgOrder - b.siblingLevelOrgOrder
  );
  const orgTreeMap: Record<string, OrgTreeNode> = {};
  sorted.forEach((o) => {
    orgTreeMap[o.id] = { org: o, children: [], contacts: [] };
  });
  sorted.forEach((o) => {
    if (o.upperLevelOrgId && orgTreeMap[o.upperLevelOrgId]) {
      orgTreeMap[o.upperLevelOrgId].children.push(orgTreeMap[o.id]);
    }
  });

  let root: OrgTreeNode | undefined;
  for (const o of sorted) {
    if (!o.upperLevelOrgId || !orgTreeMap[o.upperLevelOrgId]) {
      root = orgTreeMap[o.id];
      break;
    }
  }

  contacts.forEach((c) => {
    if (orgTreeMap[c.belongingOrgId]) {
      orgTreeMap[c.belongingOrgId].contacts.push(c);
    }
  });
  if (!root) {
    root = orgTreeMap[sorted[0].id];
  }
  return root;
}


export function layoutOrgTree(root: OrgTreeNode): PositionedNode {
  const horizontalGap = 160;
  const verticalGap = 10;
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



export function layoutNewNodes(newOrgs: Organization[]): PositionedNode[] {
  // 単純に "1ノード = 1小BOX" を横or縦に並べる例
  // ここでは "y=someFixed" で同じ高さに並べ、
  //   x をずらして配置する

  const nodeWidth = 120, nodeHeight = 50;
  const gap = 20;
  let currentX = 0;
  let currentY = 200; // 例えば mainツリーの下あたり
  
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

export function findOrgNodeAt(
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

/**
   * Contact位置判定
   *   - 組織ツリー全体をスキャンして、Contact矩形にマウスがあるかどうか
   *   - 当たれば "contactId, orgId, orientation, rectX1, rectX2, rectY1, rectY2"
   */
export function findContactAt(
  allTrees: PositionedNode[],
  x: number,
  y: number
): null | {
  contactId: string;
  orgId: string;
  orientation: 'horizontal' | 'vertical';
  rectX1: number;
  rectX2: number;
  rectY1: number;
  rectY2: number;
} {
  for (const tree of allTrees) {
    const hit = findContactAtNode(tree, x, y);
    if (hit) return hit;
  }
  return null;
}

// 再帰探索
function findContactAtNode(
  node: PositionedNode,
  x: number,
  y: number
): ReturnType<typeof findContactAt> {
  // 自分の contacts でヒットを調べる
  if (node.children.length === 0) {
    // 横並び
    const contactWidth = 80;
    const contactHeight = CONTACT_BOX_HEIGHT;
    const gap = 5;
    let cx = node.x + 10;
    const cy = node.y + 40;

    const sorted = [...node.contacts].sort((a, b) => (a.siblingOrder ?? 9999) - (b.siblingOrder ?? 9999));
    for (const c of sorted) {
      const rectX1 = cx;
      const rectY1 = cy;
      const rectX2 = rectX1 + contactWidth;
      const rectY2 = rectY1 + contactHeight;
      if (x >= rectX1 && x <= rectX2 && y >= rectY1 && y <= rectY2) {
        return {
          contactId: c.id,
          orgId: c.id,
          orientation: 'horizontal',
          rectX1, rectX2, rectY1, rectY2
        };
      }
      cx += contactWidth + gap;
    }
  } else {
    // 縦並び
    const rectWidth = node.width - 20;
    const contactHeight = CONTACT_BOX_HEIGHT;
    const gap = CONTACT_BOX_GAP;
    let cy = node.y + BOX_TOP_PADDING;

    const sorted = [...node.contacts].sort((a, b) => (a.siblingOrder ?? 9999) - (b.siblingOrder ?? 9999));
    for (const c of sorted) {
      const rectX1 = node.x + 10;
      const rectY1 = cy;
      const rectX2 = rectX1 + rectWidth;
      const rectY2 = rectY1 + contactHeight;

      if (x >= rectX1 && x <= rectX2 && y >= rectY1 && y <= rectY2) {
        return {
          contactId: c.id,
          orgId: c.id,
          orientation: 'vertical',
          rectX1, rectX2, rectY1, rectY2
        };
      }
      cy += contactHeight + gap;
    }
  }

  // 子にも問い合わせ
  for (const child of node.children) {
    const found = findContactAtNode(child, x, y);
    if (found) return found;
  }

  return null;
}


export function findPositionedNode(node: PositionedNode, orgId: string): PositionedNode | null {
  if (node.org.id === orgId) return node;
  for (const c of node.children) {
    const found = findPositionedNode(c, orgId);
    if (found) return found;
  }
  return null;
}

export function createStepPath(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2;
  return `M${x1},${y1}H${midX}V${y2}H${x2}`;
}



export function truncateContactLabel(c: Contact) {
  const full = `${c.lastName} ${c.firstName}`;
  if (full.length > 8) {
    return full.slice(0, 7) + '…';
  }
  return full;
}

export const measureTextWidth = (text: string, fontSize = 12, fontFamily = 'Arial'): number => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context!.font = `${fontSize}px ${fontFamily}`;
  return context!.measureText(text).width;
};



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



export function isDescendant(root: PositionedNode, potentialAncestorId: string, checkId: string): boolean {
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



export type DragEntityType = 'contact' | 'org';
export type DragCandidate = {
  entityType: DragEntityType;
  entityId: string;
  startX: number;
  startY: number;
};
export type DraggingState = {
  entityType: DragEntityType;
  entityId: string;
} | null;

export type SelectedEntity =
  | { type: 'org'; id: string }
  | { type: 'contact'; id: string }
  | null;

  export type DragOverMode = 'parent' | 'before' | 'after' | null;


