// DataService.ts

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

import {
  castCompanyAWSToInterface,
  castOrgAWSToInterface,
  castContactAWSToInterface,
  castOpportunityAWSToInterface,
  castActivityAWSToInterface,
  syncLocalAndRemote,
  isActDifferent,
  isCompanyDifferent,
  isContactDifferent,
  isOppDifferent,
  isOrgDifferent,
} from "./TypesAndUtils";

import type {
  Company, Organization, Contact, Opportunity, Activity
} from "./TypesAndUtils";

// Amplifyクライアント
const client = generateClient<Schema>();

/** 
 * (A) Amplify から全データをロード 
 *  - Company / Organization / Contact / Opportunity / Activity の一覧を取得して
 *    各種インターフェイスに整形して返す
 */
export async function loadAllDataFromAmplify() {
  const [companyRes, orgRes, contRes, oppRes, actRes] = await Promise.all([
    client.models.Company.list(),
    client.models.Organization.list(),
    client.models.Contact.list(),
    client.models.Opportunity.list(),
    client.models.Activity.list(),
  ]);

  // errorsチェックは割愛(必要に応じて)
  const companies = castCompanyAWSToInterface(companyRes.data ?? []);
  const orgs = castOrgAWSToInterface(orgRes.data ?? []);
  const contacts = castContactAWSToInterface(contRes.data ?? []);
  const opps = castOpportunityAWSToInterface(oppRes.data ?? []);
  const acts = castActivityAWSToInterface(actRes.data ?? []);

  return {
    companies,
    orgs,
    contacts,
    opportunities: opps,
    activities: acts,
  };
}

/**
 * (B) ローカル JSON から全データをロード
 *   - organizations.json, contacts.json, ...などを import
 *   - 必要に応じて fetch or require でもOK
 */
export async function loadAllDataFromLocalJSON() {
  const orgModule = await import("./LocalStorage/organizations.json");
  const contactModule = await import("./LocalStorage/contacts.json");
  const oppModule = await import("./LocalStorage/opportunities.json");
  const actModule = await import("./LocalStorage/activities.json");
  const compModule = await import("./LocalStorage/companies.json");

  const companies = compModule.default as Company[];
  const orgs = orgModule.default as Organization[];
  const contacts = contactModule.default as Contact[];
  const opps = oppModule.default as Opportunity[];
  const acts = actModule.default as Activity[];

  return {
    companies,
    orgs,
    contacts,
    opportunities: opps,
    activities: acts,
  };
}

/**
 * (C) Amplifyへ保存(sync)
 *  - 既存の syncLocalAndRemote を使って、Local => Amplify へ同期
 */
export async function saveAllDataToAmplify(
  companyData: Company[],
  orgData: Organization[],
  contactData: Contact[],
  opportunityData: Opportunity[],
  activityData: Activity[]
) {
  // (0) Company
  await syncLocalAndRemote<Company>({
    localArray: companyData,
    listFn: client.models.Company.list,
    createFn: client.models.Company.create,
    updateFn: client.models.Company.update,
    deleteFn: client.models.Company.delete,
    castFn: castCompanyAWSToInterface,
    isDifferentFn: isCompanyDifferent,
    getPk: (comp) => comp.id,
  });

  // (1) Org
  await syncLocalAndRemote<Organization>({
    localArray: orgData,
    listFn: client.models.Organization.list,
    createFn: client.models.Organization.create,
    updateFn: client.models.Organization.update,
    deleteFn: client.models.Organization.delete,
    castFn: castOrgAWSToInterface,
    isDifferentFn: isOrgDifferent,
    getPk: (org) => org.id,
  });

  // (2) Contact
  await syncLocalAndRemote<Contact>({
    localArray: contactData,
    listFn: client.models.Contact.list,
    createFn: client.models.Contact.create,
    updateFn: client.models.Contact.update,
    deleteFn: client.models.Contact.delete,
    castFn: castContactAWSToInterface,
    isDifferentFn: isContactDifferent,
    getPk: (c) => c.id,
  });

  // (3) Opportunity
  await syncLocalAndRemote<Opportunity>({
    localArray: opportunityData,
    listFn: client.models.Opportunity.list,
    createFn: client.models.Opportunity.create,
    updateFn: client.models.Opportunity.update,
    deleteFn: client.models.Opportunity.delete,
    castFn: castOpportunityAWSToInterface,
    isDifferentFn: isOppDifferent,
    getPk: (o) => o.id,
  });

  // (4) Activity
  await syncLocalAndRemote<Activity>({
    localArray: activityData,
    listFn: client.models.Activity.list,
    createFn: client.models.Activity.create,
    updateFn: client.models.Activity.update,
    deleteFn: client.models.Activity.delete,
    castFn: castActivityAWSToInterface,
    isDifferentFn: isActDifferent,
    getPk: (a) => a.id,
  });


}

export function saveAllDataToLocalJSON(
  companyData: Company[],
  orgData: Organization[],
  contactData: Contact[],
  opportunityData: Opportunity[],
  activityData: Activity[]
) {
  // 1) まず JSON 化
  const payloadObj = {
    companies: companyData,
    orgs: orgData,
    contacts: contactData,
    opportunities: opportunityData,
    activities: activityData,
  };
  const jsonStr = JSON.stringify(payloadObj, null, 2); // 整形

  // 2) localStorage に保存 (キーは適当に)
  localStorage.setItem("myLocalJSONBackup", jsonStr);

  // 3) ダウンロード用ファイルを作る
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // 4) ダウンロードリンクを自動クリック
  const a = document.createElement('a');
  a.href = url;
  a.download = 'backupData.json'; // ダウンロードファイル名
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // 後片付け
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}