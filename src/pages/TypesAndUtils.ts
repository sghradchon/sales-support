
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
  
  export interface OrgMap {
    [companyId: string]: Organization[];
  }

  export interface ContactMap {
    [companiId:string]:Contact[]
  }
  
  export   interface Contact {
    id: string;
    lastName: string;
    firstName: string;
    belongingOrgId: string;
    belongingCompanyId:string;
    title: string;
    contactLevel: number;
    contactDescription: string;
    keyPerson: boolean;
  }
  
  
  export interface Opportunity {
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
  
  export interface Activity {
    id: string; //PK
    contactId: string;
    activity: string;
  }

  
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
  export const castContactAWSToInterface = (data: any[]) => {
    return data.map((item) => {
        return {
          id: item.id ?? '',
          lastName: item.lastName ?? '',
          firstName: item.firstName ?? '',
          belongingOrgId: item.belongingOrgId ?? '',
          belongingCompanyId: item.belongingCompanyId ?? '',
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
      if (localObj.siblingLevelOrgOrder !== remoteObj.siblingLevelOrgOrder) return true;
      if (localObj.companyId !== remoteObj.companyId) return true;
      if (localObj.memo !== remoteObj.memo) return true;
      return false;
    }
  
    export function isContactDifferent(localC: Contact, remoteC: any): boolean {
      if (localC.lastName !== remoteC.lastName) return true;
      if (localC.firstName !== remoteC.firstName) return true;
      if (localC.belongingOrgId !== remoteC.belongingOrgId) return true;
      if (localC.belongingCompanyId !== remoteC.belongingCompanyId) return true;
      if (localC.title !== remoteC.title) return true;
      if (localC.contactLevel !== remoteC.contactLevel) return true;
      if (localC.contactDescription !== remoteC.contactDescription) return true;
      return false;
    }
  
  export  function isOppDifferent(localO: Opportunity, remoteO: any): boolean {
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
    
  export   function isActDifferent(localA: Activity, remoteA: any): boolean {
      if (localA.contactId !== remoteA.contactId) return true;
      if (localA.activity !== remoteA.activity) return true;
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


