import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  useToast,
  Input,
  Select,  // 追加
} from '@chakra-ui/react';
import { RxReset } from "react-icons/rx";

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
import CompanyComponent from './CompanyComponent';
import { v4 as uuidv4 } from 'uuid';

/** SalesHeatMapPage */
const SalesHeatMapPage: React.FC = () => {
  const toast = useToast();

  // === (A) 全データのstate ===
  const [companyData,       setCompanyData      ] = useState<Company[]>([]);
  const [orgData,           setOrgData          ] = useState<Organization[]>([]);
  const [contactData,       setContactData      ] = useState<Contact[]>([]);
  const [opportunityData,   setOpportunityData  ] = useState<Opportunity[]>([]);
  const [activityData,      setActivityData     ] = useState<Activity[]>([]);

  const [companyMap,        setCompanyMap       ] = useState<CompanyMap>({});
  const [orgByCompany,      setOrgByCompany     ] = useState<OrgByCompanyMap>({});
  const [contactByCompany,  setContactByCompany ] = useState<ContactByCompanyMap>({});

  // 新会社追加用
  const [newCompanyName,    setNewCompanyName   ] = useState("");

  // === (B) データモード選択用 (Amplify or Local JSON) ===
  const [dataMode, setDataMode] = useState<'amplify' | 'local'>('amplify');

  // --- (1) データロード ---
  // dataMode が変わるたびに再ロード (初回含む)
  useEffect(() => {
    handleLoadAll();
    // eslint-disable-next-line
  }, [dataMode]);

  // データをまとめて読み込む関数
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
        // local JSON
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

  // --- (2) useEffect で各種マップ化 ---
  useEffect(() => {
    // 会社ID を key に Company を持つマップ
    const cmpMap: CompanyMap = companyData.reduce((acc, company) => {
      acc[company.id] = company;
      return acc;
    }, {} as CompanyMap);
    setCompanyMap(cmpMap);

    // Org を会社ごとにまとめる
    const companyIds = companyData.map(c => c.id);
    const newOrgMap: OrgByCompanyMap = companyIds.reduce((acc, cid) => {
      acc[cid] = orgData.filter(o => o.companyId === cid);
      return acc;
    }, {} as OrgByCompanyMap);
    setOrgByCompany(newOrgMap);

    // Contact を会社ごとにまとめる
    const newContactMap: ContactByCompanyMap = createContactByCompany(companyData, orgData, contactData);
    setContactByCompany(newContactMap);

  }, [companyData, orgData, contactData]);

  // --- (3) setter関数 (Org/Contact) ---
  function updateOrgDataForCompany(
    companyId: string,
    partial: Organization[] | ((prev: Organization[]) => Organization[])
  ) {
    setOrgData((prevAll) => {
      const subset = prevAll.filter(o => o.companyId === companyId);
      let newSubset: Organization[];
      if (typeof partial === 'function') {
        newSubset = partial(subset);
      } else {
        newSubset = partial;
      }
      const others = prevAll.filter(o => o.companyId !== companyId);
      return [...others, ...newSubset];
    });
  }

  function updateContactDataForCompany(
    companyId: string,
    partial: Contact[] | ((prev: Contact[]) => Contact[])
  ) {
    setContactData((prevAll) => {
      // 会社に属する Contact 一覧を抽出
      const subset = getContactsByTheCompany(prevAll, orgData, companyId);

      let newSubset: Contact[];
      if (typeof partial === 'function') {
        newSubset = partial(subset);
      } else {
        newSubset = partial;
      }
      // "他社" の contacts (subsetに含まれないもの) は残す
      const others = prevAll.filter(o => !subset.includes(o));
      return [...others, ...newSubset];
    });
  }

  // --- (4) 保存(Sync) ---
  // Amplify 以外に保存実装がなければ、Local JSON モード時はスキップなど
  const handleSaveAll = async () => {
    if (dataMode === 'amplify') {
      try {
        await saveAllDataToAmplify(
          companyData, orgData, contactData, opportunityData, activityData
        );
        toast({ title: 'All changes saved to Amplify!', status: 'success' });
      } catch (err) {
        console.error(err);
        toast({ title: 'saveAllChanges failed', status: 'error' });
      }
    } else {
      // local モード時 => localStorage & ファイルダウンロード
      saveAllDataToLocalJSON(
        companyData, orgData, contactData, opportunityData, activityData
      );
      toast({ title: 'Saved to local JSON (download)', status: 'success' });
    }
  };

  // --- (5) リセット(=再読み込み) ---
  const handleResetData = async () => {
    // dataMode に合わせて 再読み込み
    await handleLoadAll();
    toast({ title: `Reset to ${dataMode} data done`, status: 'info' });
  };

  // --- (6) 会社追加 ---
  const handleAddCompany = () => {
    if (!newCompanyName.trim()) return;
    const newId = `COMPANY_${uuidv4()}`;
    const newCompany: Company = {
      id: newId,
      companyName: newCompanyName.trim(),
      upperLevelCompanyId: "",
      memo: ''
    };
    setCompanyData([...companyData, newCompany]);
    setNewCompanyName('');
    toast({ title: 'Added company locally (not saved yet)', status: 'info' });
  };

  // === Render ===
  return (
    <Box p={4}>
      {/* データソース選択 (Amplify or Local) */}
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

        {/* 保存ボタン */}
        <Button colorScheme="blue" onClick={handleSaveAll} mr={4}>
          SAVE
        </Button>

        {/* リセットアイコン */}
        <Box onClick={handleResetData} cursor="pointer" mr={4}>
          <RxReset />
        </Box>

        {/* 新会社入力 */}
        <Input
          placeholder="新しい会社名"
          value={newCompanyName}
          onChange={(e) => setNewCompanyName(e.target.value)}
          width="200px"
          mr={2}
        />
        <Button onClick={handleAddCompany}>
          会社追加
        </Button>
      </Box>

      {/* 会社一覧を描画 */}
      {Object.entries(companyMap).map(([companyId, comp]) => (
        <CompanyComponent
          key={companyId}
          company={comp}
          orgData={orgByCompany[companyId] || []}
          contactData={contactByCompany[companyId] || []}
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