
import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Box,
  Button,
  Text,
  HStack,
  FormControl,
  FormLabel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  SimpleGrid,
  Image,
} from '@chakra-ui/react';
import { FaRegEdit } from 'react-icons/fa';
import { Contact, Opportunity, Activity } from "./TypesAndUtils";
import { v4 as uuidv4 } from 'uuid';

// ========== Propsの型定義 ==========
interface ContactPageProps {
  contact: Contact;
  onClose: () => void;
  onAddActivity: (activity: Activity) => void;
  onAddOpportunity: (opportunity: Opportunity) => void;
  activities: Activity[];
  opportunities: Opportunity[];
}

const ContactPage: React.FC<ContactPageProps> = ({
  contact,
  onClose,
  onAddActivity,
  onAddOpportunity,
  activities,
  opportunities,
}) => {

  // --- (1) Activity 関連 ---
  // インターフェイスに従い `activityDate` は optional として扱う例
  const activityList = activities.filter((act) => act.contactId === contact.id);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [todoModalActivity, setTodoModalActivity] = useState<Activity | null>(null);
  const [editedTodoDate, setEditedTodoDate] = useState('');
  const [newActivityModalOpen, setNewActivityModalOpen] = useState(false);

  // 新規活動入力用
  const todayStr = new Date().toISOString().split('T')[0]; // 例: "2023-09-20"
  const [newActivityDate, setNewActivityDate] = useState(todayStr);
  const [newContent, setNewContent] = useState('');
  const [newTodoDate, setNewTodoDate] = useState(todayStr);
  const [newTodo, setNewTodo] = useState('');

  const handleTodoSave = () => {
    if (todoModalActivity) {
      // TODO日だけ更新例
      todoModalActivity.todoDate = editedTodoDate;
      // 実際には onAddActivity か "onUpdateActivity" が必要になるかもしれません
      setTodoModalActivity(null);
    }
  };

  const handleNewActivitySave = () => {
    // 新規追加する Activity
    // id は実プロジェクトで uuid など生成してください
    const newAct: Activity = {
      id: `ACT_${uuidv4()}`,
      contactId: contact.id,
      content: newContent,
      activityDate: newActivityDate, // optional扱い
      todoDate: newTodoDate,
      todo: newTodo,
    };
    if (onAddActivity) onAddActivity(newAct);
    // 入力フィールドをリセット
    setNewActivityDate(todayStr);
    setNewContent('');
    setNewTodoDate(todayStr);
    setNewTodo('');
    setNewActivityModalOpen(false);
  };

  // --- (2) Opportunity 関連 ---
  const opportunityList = opportunities.filter((opp) => opp.contactId === contact.id);

  const [newOpportunityModalOpen, setNewOpportunityModalOpen] = useState(false);
  const [newOpportunityName, setNewOpportunityName] = useState('');
  const [newOpportunityMotive, setNewOpportunityMotive] = useState(''); // 例: Application に対応
  const [newOpportunityStartDate, setNewOpportunityStartDate] = useState(todayStr); // => ScheduleSpec
  const [newOpportunityPlannedClosingDate, setNewOpportunityPlannedClosingDate] = useState(todayStr); // => ScheduleDelivery
  const [newOpportunityPhotoFile, setNewOpportunityPhotoFile] = useState<File | null>(null);
  const [newOpportunityCurrentStage, setNewOpportunityCurrentStage] = useState(''); // => OpportunityStage

  const handleNewOpportunitySave = () => {
    // 例: ID 生成
    const newOpportunityId = `OOP_${uuidv4()}`;
    const newOpp: Opportunity = {
      id: newOpportunityId,
      contactId: contact.id,

      // こちらがインターフェイスで必須のフィールド
      OpportunityName: newOpportunityName,   // 案件名
      CustomerName: '',                      // デモのため空に
      ProductName: '',
      Distributor: '',
      Application: newOpportunityMotive,     // motiveをApplicationに対応づけ
      Territory: '',
      TargetPrice: 0,
      CustomerBudget: 0,
      CompetitorPrice: 0,
      ScheduleSpec: newOpportunityStartDate, // "開始日"をScheduleSpecに対応
      ScheduleQuote: '',
      ScheduleOrder: '',
      ScheduleDelivery: newOpportunityPlannedClosingDate, // "予定終了日"をScheduleDeliveryに対応
      CustomerProductImage: newOpportunityPhotoFile
        ? URL.createObjectURL(newOpportunityPhotoFile)
        : '',
      OpportunityStage: newOpportunityCurrentStage,
      CurrentStatus: '',  // 空文字
    };

    if (onAddOpportunity) onAddOpportunity(newOpp);

    // 案件入力フィールドリセット
    setNewOpportunityName('');
    setNewOpportunityMotive('');
    setNewOpportunityStartDate(todayStr);
    setNewOpportunityPlannedClosingDate(todayStr);
    setNewOpportunityPhotoFile(null);
    setNewOpportunityCurrentStage('');
    setNewOpportunityModalOpen(false);
  };

  // --- (3) レンダリング ---
  return (
    <>
      <ModalHeader>担当者情報</ModalHeader>
      <ModalCloseButton />
      <ModalBody minWidth="70vw">
        <Tabs variant="enclosed" isFitted>
          <TabList>
            <Tab>基本情報</Tab>
            <Tab>活動</Tab>
            <Tab>案件</Tab>
          </TabList>
          <TabPanels>
            {/* (A) 基本情報 */}
            <TabPanel>
              <Box>
                <Text>氏名: {contact.lastName} {contact.firstName}</Text>
                <Text>役職: {contact.title}</Text>
                <Text>説明: {contact.contactDescription}</Text>
                <Text>キーパーソン: {contact.keyPerson ? "はい" : "いいえ"}</Text>

                {/* 新インターフェイス要素 */}
                <Text>趣味: {contact.hobby}</Text>
                <Text>家族構成: {contact.familyMember}</Text>
                <Text>前職: {contact.previousCareer}</Text>
                <Text>専門: {contact.speciality}</Text>
                <Text>酒の好み: {contact.alcoholPreference}</Text>
                <Text>食の好み: {contact.foodPreference}</Text>
              </Box>
            </TabPanel>

            {/* (B) 活動タブ */}
            <TabPanel>
              <Box>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontWeight="bold" mb={2}>活動一覧:</Text>
                  <Button size="sm" onClick={() => setNewActivityModalOpen(true)}>
                    新規
                  </Button>
                </HStack>
                {activityList && activityList.length > 0 ? (
                  <Table variant="simple" size="sm" fontSize="sm">
                    <Thead>
                      <Tr>
                        <Th>活動日</Th>
                        <Th>内容</Th>
                        <Th>TODO日</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {activityList.map((activity, index) => (
                        <Tr key={activity.id || index}>
                          <Td>{activity.activityDate}</Td>
                          <Td>
                            <Text
                              cursor="pointer"
                              color="blue.500"
                              onClick={() => setSelectedActivity(activity)}
                            >
                              {activity.content.length > 20
                                ? activity.content.substring(0, 20) + '...'
                                : activity.content}
                            </Text>
                          </Td>
                          <Td>
                            <HStack spacing={2}>
                              <Text>{activity.todoDate}</Text>
                              <FaRegEdit
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setTodoModalActivity(activity);
                                  setEditedTodoDate(activity.todoDate);
                                }}
                              />
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  <Box>活動はありません</Box>
                )}
              </Box>
            </TabPanel>

            {/* (C) 案件タブ */}
            <TabPanel>
              <Box>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontWeight="bold" mb={2}>案件一覧:</Text>
                  <Button size="sm" onClick={() => setNewOpportunityModalOpen(true)}>
                    新規
                  </Button>
                </HStack>
                {opportunityList && opportunityList.length > 0 ? (
                  <SimpleGrid columns={[1, 2, 3]} spacing={4}>
                    {opportunityList.map((opp) => (
                      <Box key={opp.id} borderWidth="1px" borderRadius="md" p={4}>
                        {/* 画像を表示：サンプルとして imageForDemo/ 下を参照 */}
                        <Image 
                          src={`/imageForDemo/${opp.CustomerProductImage}`} 
                          alt={opp.OpportunityName} 
                          boxSize="60px" 
                          objectFit="cover" 
                        />

                        <Text fontWeight="bold" mt="8px">{opp.OpportunityName}</Text>
                        <Text fontSize="14px">製品名: {opp.ProductName}</Text>
                        <Text fontSize="14px">代理店名: {opp.Distributor}</Text>
                        <Text fontSize="14px">ターゲット価格: {opp.TargetPrice}</Text>
                        <Text fontSize="14px">顧客予算: {opp.CustomerBudget}</Text>
                        <Text fontSize="14px">競合価格: {opp.CompetitorPrice}</Text>
                        <Text fontSize="14px">PJ開始日: {opp.ScheduleSpec}</Text>
                        <Text fontSize="14px">PJ受注予定日: {opp.ScheduleOrder}</Text>
                        <Text fontSize="14px">PJ納入希望日: {opp.ScheduleDelivery}</Text>
                        <Text fontSize="14px">ステージ: {opp.OpportunityStage}</Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                ) : (
                  <Box>案件はありません</Box>
                )}
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>閉じる</Button>
      </ModalFooter>

      {/* === 活動内容 全文表示モーダル === */}
      {selectedActivity && (
        <Modal isOpen={true} onClose={() => setSelectedActivity(null)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>活動内容詳細</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text>{selectedActivity.content}</Text>
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setSelectedActivity(null)}>閉じる</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* === TODO編集モーダル === */}
      {todoModalActivity && (
        <Modal isOpen={true} onClose={() => setTodoModalActivity(null)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>TODO日変更</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Input
                type="date"
                value={editedTodoDate}
                onChange={(e) => setEditedTodoDate(e.target.value)}
              />
              <Box mt={2}>
                <Button
                  size="sm"
                  onClick={() => {
                    const baseDate = editedTodoDate ? new Date(editedTodoDate) : new Date();
                    const newDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                    setEditedTodoDate(newDate.toISOString().split('T')[0]);
                  }}
                >
                  1週後に変更する
                </Button>
                <Button
                  size="sm"
                  ml={2}
                  onClick={() => {
                    const baseDate = editedTodoDate ? new Date(editedTodoDate) : new Date();
                    const newDate = new Date(baseDate);
                    newDate.setMonth(newDate.getMonth() + 1);
                    setEditedTodoDate(newDate.toISOString().split('T')[0]);
                  }}
                >
                  1ヶ月後に変更する
                </Button>
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button onClick={handleTodoSave}>保存</Button>
              <Button onClick={() => setTodoModalActivity(null)} ml={2}>
                キャンセル
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* === 新規活動入力モーダル === */}
      {newActivityModalOpen && (
        <Modal isOpen={true} onClose={() => setNewActivityModalOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>新規活動入力</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl mb={3}>
                <FormLabel>活動日</FormLabel>
                <Input
                  type="date"
                  value={newActivityDate}
                  onChange={(e) => setNewActivityDate(e.target.value)}
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>内容</FormLabel>
                <Input
                  type="text"
                  minH="100px"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>TODO日</FormLabel>
                <Input
                  type="date"
                  value={newTodoDate}
                  onChange={(e) => setNewTodoDate(e.target.value)}
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>TODO</FormLabel>
                <Input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button onClick={handleNewActivitySave}>保存</Button>
              <Button onClick={() => setNewActivityModalOpen(false)} ml={2}>
                キャンセル
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* === 新規案件入力モーダル === */}
      {newOpportunityModalOpen && (
        <Modal isOpen={true} onClose={() => setNewOpportunityModalOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>新規案件入力</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl mb={3}>
                <FormLabel>案件名</FormLabel>
                <Input
                  type="text"
                  value={newOpportunityName}
                  onChange={(e) => setNewOpportunityName(e.target.value)}
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>目的（Application相当）</FormLabel>
                <Input
                  type="text"
                  value={newOpportunityMotive}
                  onChange={(e) => setNewOpportunityMotive(e.target.value)}
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>開始日（ScheduleSpec）</FormLabel>
                <Input
                  type="date"
                  value={newOpportunityStartDate}
                  onChange={(e) => setNewOpportunityStartDate(e.target.value)}
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>予定終了日（ScheduleDelivery）</FormLabel>
                <Input
                  type="date"
                  value={newOpportunityPlannedClosingDate}
                  onChange={(e) => setNewOpportunityPlannedClosingDate(e.target.value)}
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>写真アップロード（CustomerProductImage）</FormLabel>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setNewOpportunityPhotoFile(e.target.files[0]);
                    }
                  }}
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>ステージ（OpportunityStage）</FormLabel>
                <Input
                  type="text"
                  value={newOpportunityCurrentStage}
                  onChange={(e) => setNewOpportunityCurrentStage(e.target.value)}
                />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button onClick={handleNewOpportunitySave}>保存</Button>
              <Button onClick={() => setNewOpportunityModalOpen(false)} ml={2}>
                キャンセル
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};

export default ContactPage;