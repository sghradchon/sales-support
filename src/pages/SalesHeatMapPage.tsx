import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Button,
  useToast,
  useDisclosure,
  Input
} from '@chakra-ui/react';
import { RxReset } from "react-icons/rx";

import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Company,CompanyMap,OrgMap,Organization, Contact,ContactMap,Opportunity, Activity} from "./TypesAndUtils"
import { PositionedNode,DragOverMode,DragCandidate,DraggingState,SelectedEntity } from './TypesAndUtils';
import { castCompanyAWSToInterface,castOrgAWSToInterface,castContactAWSToInterface,castOpportunityAWSToInterface,castActivityAWSToInterface } from './TypesAndUtils';
import { syncLocalAndRemote,isActDifferent,isCompanyDifferent,isContactDifferent,isOppDifferent,isOrgDifferent } from './TypesAndUtils';
import { v4 as uuidv4 } from 'uuid';

import CompanyComponent from './CompanyComponent';

const client = generateClient<Schema>();



// ---------------------------
const SalesHeatMapPage: React.FC = () => {
  const toast = useToast();

  const [companyData, setCompanyData] = useState<Company[]>([]);
  const [orgData, setOrgData] = useState<Organization[]>([]);
  const [contactData, setContactData] = useState<Contact[]>([]);
  const [companyMap,setCompanyMap] = useState<CompanyMap>({});
  const [orgByCompany, setOrgByCompany] = useState<OrgMap>({});
  const [contactByCompany, setContactByCompany] = useState<ContactMap>({});

  const [opportunityData, setOpportunityData] = useState<Opportunity[]>([]);
  const [activityData, setActivityData] = useState<Activity[]>([]);
  const [positionedRoot, setPositionedRoot] = useState<PositionedNode | null>(null);
  const [positionedNewNodes, setPositionedNewNodes] = useState<PositionedNode[]>([]);
  
  const [newCompanyName,setNewCompanyName] = useState<string>("")
  //
  // 1) データ読み込み
  //

  useEffect(() => {
    const loadData = async () => {
      try {
        
             // Amplify Data API から一覧取得
        const { data: companyRes, errors: companyErr } = await client.models.Company.list();
        const { data: orgRes, errors: orgErr } = await client.models.Organization.list();
        const { data: contactRes, errors: contErr } = await client.models.Contact.list();
        const { data: oppRes, errors: oppErr } = await client.models.Opportunity.list();
        const { data: actRes, errors: actErr } = await client.models.Activity.list();
        
        if (companyErr || orgErr || contErr|| oppErr || actErr) {
          console.error(companyErr ?? orgErr ?? contErr ?? oppErr ?? actErr);
          toast({ title:'Create error', status:'error'});
          // toast などで通知してもOK
          return;
        }
        // null→非null 変換
        const companies = castCompanyAWSToInterface(companyRes)
        const orgs = castOrgAWSToInterface(orgRes)
        const contacts = castContactAWSToInterface(contactRes)
        const opps = castOpportunityAWSToInterface(oppRes);
        const acts = castActivityAWSToInterface(actRes);
        

        setCompanyData(companies || []);
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

  useEffect(() => {
    const companyMap: CompanyMap = companyData.reduce((acc, company) => {
      acc[company.id] = company;
      return acc;
    }, {} as CompanyMap);
    setCompanyMap(companyMap);

    const companyIds = companyData.map(c => c.id);

    // orgDataをマップ化（該当なしの場合は空配列をセット）
    const newOrgMap: OrgMap = companyIds.reduce((acc, companyId) => {
      acc[companyId] = orgData.filter(org => org.companyId === companyId);
      return acc;
    }, {} as OrgMap);

    setOrgByCompany(newOrgMap);
    console.log(newOrgMap,"newOrgMap")

    // contactDataをマップ化（該当なしの場合は空配列をセット）
    const newContactMap: ContactMap = companyIds.reduce((acc, companyId) => {
      acc[companyId] = contactData.filter(contact => contact.belongingCompanyId === companyId);
      return acc;
    }, {} as ContactMap);

    setContactByCompany(newContactMap);
    

  }, [companyData,orgData,contactData]);


 
  //
  // 組織追加・削除・リセット
  //
  // 会社単位で orgData を差し替え
  // 部分マージする関数: "companyId" 分だけ差し替え
  function updateOrgDataForCompany(
    companyId: string,
    partial: Organization[] | ((prev: Organization[]) => Organization[])
  ){
    setOrgData((prevAll) => {
      // 1) まず "この会社" の部分を取り出す
      const subset = prevAll.filter(o => o.companyId === companyId);
      // 2) partial が 関数か配列かで処理分岐
      let newSubset: Organization[];
      if (typeof partial === 'function') {
        // 関数として呼び出す(= (prev: Organization[]) => Organization[])
        newSubset = partial(subset);
      } else {
        // 直接配列
        newSubset = partial;
      }
      // 3) "他社" を除外 + "newSubset" を合体
      const others = prevAll.filter(o => o.companyId !== companyId);
      return [...others, ...newSubset];
    });
  }
  // ========== Setter: contactData ==========
  // 部分マージする関数: "companyId" 分だけ差し替え
  function updateContactDataForCompany(
    companyId: string,
    partial: Contact[] | ((prev: Contact[]) => Contact[])
  ){
    setContactData((prevAll) => {
      // 1) まず "この会社" の部分を取り出す
      const subset = prevAll.filter(o => o.belongingCompanyId === companyId);
      // 2) partial が 関数か配列かで処理分岐
      let newSubset: Contact[];
      if (typeof partial === 'function') {
        // 関数として呼び出す(= (prev: Organization[]) => Organization[])
        newSubset = partial(subset);
      } else {
        // 直接配列
        newSubset = partial;
      }
      // 3) "他社" を除外 + "newSubset" を合体
      const others = prevAll.filter(o => o.belongingCompanyId !== companyId);
      return [...others, ...newSubset];
    });
  }



  async function saveAllChangesToAmplify() {
    try {
      //----------0) Company 同期---------
      await syncLocalAndRemote<Company>({
        localArray: companyData,
        listFn: client.models.Company.list,
        createFn: client.models.Company.create,
        updateFn: client.models.Company.update,
        deleteFn: client.models.Company.delete,
        castFn: castCompanyAWSToInterface,
        isDifferentFn: isCompanyDifferent,
        getPk: (comp)=> comp.id,
      })

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


  async function handleResetData() {
    try {
      //0)Comp
      const { data: companyRes, errors: companyErr } = await client.models.Company.list();
      if (companyErr) { throw new Error('company list error'); }
      setCompanyData(castCompanyAWSToInterface(companyRes || []));

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

  //company 追加
  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return;
        
  
    // 2) 新しい組織
    const newId = `COMPANY_${uuidv4()}`;
    const newCompany: Company = {
      id: newId,
      companyName: newCompanyName.trim(),
      upperLevelCompanyId: "",
      memo: ''
    };
  
    setCompanyData([...companyData, newCompany]);
    console.log("newCompany",newCompany)
    setNewCompanyName('');
    // toast
    toast({ title: 'Added company locally (not saved yet)', status: 'info' });
  }

  
  //
  // 11) モーダル
  //
  

  return (
    <Box p={4}>
      

      <Box mb={2}>
        <Button colorScheme="blue" onClick={saveAllChangesToAmplify} mr={4}>
          SAVE
        </Button>
     
        <Box onClick={handleResetData} cursor="pointer">
                  <RxReset />
        </Box>
          <Input
                  placeholder="新しい会社名"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  width="200px"
                  mr={2}
                />
                <Button onClick={handleAddCompany} mr={10}>会社追加</Button>

      </Box>

      {Object.entries(companyMap).map(([companyId, comp]) => (
      <CompanyComponent 
        key={companyId}
        company={comp}  // ←修正点 ({}で囲む)
        orgData={orgByCompany[companyId]}
        contactData={contactByCompany[companyId]}
        opportunityData={opportunityData}
        activityData={activityData}
        setOrgData={(updatedSubset) => updateOrgDataForCompany(companyId, updatedSubset)}
        setContactData={(updatedSubset) => updateContactDataForCompany(companyId, updatedSubset)}
        setOpportunityData={setOpportunityData}
        setActivityData={setActivityData}
      />
    ))}

      
    </Box>
  );
};

export default SalesHeatMapPage;