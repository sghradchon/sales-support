import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

// ========== 型定義例 ==========
// 実際のアプリケーションでは別ファイルに定義しimportするなど、構成は自由に変更してください。

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
  
interface Activity {
  id: string;         // PK (Amplify)
  contactId: string;
  activity: string;
}

interface Opportunity {
  id: string;         // PK (Amplify)
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
}

// ========== Propsの型定義 ==========
interface ContactPageProps {
  contact: Contact;
  onClose: () => void;
  onAddActivity: (activity: Activity) => void;
  onAddOpportunity: (opportunity: Opportunity) => void;
  activities: Activity[];
  opportunities: Opportunity[];
}

// ========== コンポーネント本体 ==========
const ContactPage: React.FC<ContactPageProps> = ({
  contact,
  onClose,
  onAddActivity,
  onAddOpportunity,
  activities,
  opportunities
}) => {
  // 新しいActivityを追加するためのState
  const [newActivity, setNewActivity] = useState("");

  // 新しいOpportunityを追加するための簡易的なState
  const [newOpportunityName, setNewOpportunityName] = useState("");

  // 追加したいActivityをonAddActivityに渡す
  const handleAddActivityClick = () => {
    if (!newActivity) return;
    onAddActivity({
      id:`ACT_${uuidv4()}`,
      contactId: contact.id,
      activity: newActivity
    });
    setNewActivity("");
  };

  // 追加したいOpportunityをonAddOpportunityに渡す
  const handleAddOpportunityClick = () => {
    if (!newOpportunityName) return;
    onAddOpportunity({
      id: `OPP_${uuidv4()}`  ,     // null
      contactId: contact.id,
      CustomerName: contact.lastName,
      ProductName: "Sample Product",
      OpportunityName: newOpportunityName,
      Distributor: "Sample Distributor",
      Application: "Sample Application",
      Territory: "Sample Territory",
      TargetPrice: 100,
      CustomerBudget: 1000,
      CompetitorPrice: 90,
      CurrentStatus: "Open"
    });
    setNewOpportunityName("");
  };

  // contactId に紐づくアクティビティのみを抽出
  const filteredActivities = activities.filter(
    (act) => act.contactId === contact.id
  );

  // contactId に紐づくオポチュニティのみを抽出
  const filteredOpportunities = opportunities.filter(
    (opp) => opp.contactId === contact.id
  );

  return (
    <div style={{ border: "1px solid #ccc", padding: "16px" }}>
      <h2>Contact: {contact.lastName}</h2>
      <button onClick={onClose}>Close</button>

      {/* ===== Activitiesセクション ===== */}
      <section>
        <h3>Activities</h3>
        <ul>
          {filteredActivities.map((act, index) => (
            <li key={index}>{act.activity}</li>
          ))}
        </ul>
        <div>
          <input
            type="text"
            value={newActivity}
            onChange={(e) => setNewActivity(e.target.value)}
            placeholder="Add new activity"
          />
          <button onClick={handleAddActivityClick}>Add Activity</button>
        </div>
      </section>

      {/* ===== Opportunitiesセクション ===== */}
      <section>
        <h3>Opportunities</h3>
        <ul>
          {filteredOpportunities.map((opp, index) => (
            <li key={index}>
              {opp.OpportunityName} - Status: {opp.CurrentStatus}
            </li>
          ))}
        </ul>
        <div>
          <input
            type="text"
            value={newOpportunityName}
            onChange={(e) => setNewOpportunityName(e.target.value)}
            placeholder="New Opportunity Name"
          />
          <button onClick={handleAddOpportunityClick}>Add Opportunity</button>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;