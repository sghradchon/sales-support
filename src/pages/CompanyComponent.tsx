import React, { useEffect, useState, useRef, Dispatch, SetStateAction } from 'react';
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
  HStack,
  Textarea,
  Checkbox
} from '@chakra-ui/react';
import { v4 as uuidv4 } from 'uuid';

import ContactPage from "./ContactPage";

import { Company, Organization, Contact, Opportunity, Activity } from "./TypesAndUtils"
import { PositionedNode, DragOverMode, DragCandidate, DraggingState, SelectedEntity } from './TypesAndUtils';
import { 
  buildOrgTree,
  layoutOrgTree,
  findOrgNodeAt,
  findPositionedNode,
  createStepPath,
  measureTextWidth,
  truncateContactLabel,
  layoutNewNodes,
  isDescendant,
  // ★★ ADDED for CONTACT REORDER
  findContactAt
} from './TypesAndUtils';
import { GripVertical } from 'lucide-react';

const BOX_TOP_PADDING = 40;
const CONTACT_BOX_HEIGHT = 20;
const CONTACT_BOX_GAP = 5;

const svgWidth = 1200;
const svgHeight = 300;

interface CompanyProps {
  company: Company;
  orgData: Organization[];
  contactData: Contact[];
  opportunityData: Opportunity[];
  activityData: Activity[];
  setOrgData: (updated: Organization[] | ((prev: Organization[]) => Organization[])) => void;
  setContactData: (updated: Contact[] | ((prev: Contact[]) => Contact[])) => void;

  setOpportunityData: Dispatch<SetStateAction<Opportunity[]>>;
  setActivityData: Dispatch<SetStateAction<Activity[]>>;
}

// 定義する型
interface NewContactForm {
  lastName: string;
  firstName: string;
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

// 初期値（default state）
const initialContactForm: NewContactForm = {
  lastName: '',
  firstName: '',
  title: '',
  contactLevel: 0,
  contactDescription: '',
  keyPerson: false,
  siblingOrder: 0,
  hobby: '',
  familyMember: '',
  previousCareer: '',
  speciality: '',
  alcoholPreference: '',
  foodPreference: '',
};

const CompanyComponent: React.FC<CompanyProps> = (props) => {
  const {
    company,
    orgData, 
    contactData,
    opportunityData,
    activityData,
    setOrgData,
    setContactData,
    setOpportunityData,
    setActivityData,
  } = props;

  const toast = useToast();

  const [positionedRoot, setPositionedRoot] = useState<PositionedNode | null>(null);
  const [positionedNewNodes, setPositionedNewNodes] = useState<PositionedNode[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const isPanningRef = useRef(false);

  // ドラッグ管理
  const [dragCandidate, setDragCandidate] = useState<DragCandidate | null>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

  // ハイライト対象 (Org or Contact)
  const [dragOverOrgId, setDragOverOrgId] = useState<string | null>(null);
  const [dragOverContactId, setDragOverContactId] = useState<string | null>(null); // ★★ ADDED for CONTACT REORDER
  const [dragOverMode, setDragOverMode] = useState<DragOverMode>(null);

  // Pan/Zoom
  const translateX = 50;
  const translateY = 50;
  const [scale, setScale] = useState(1);
  const lastPointerPosRef = useRef({ x: 0, y: 0 });

  // モーダル
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);

  // 組織追加
  const [newOrgName, setNewOrgName] = useState('');

  // Contact追加フォーム
  const [newContactForm, setNewContactForm] = useState<NewContactForm>(initialContactForm);

  // フォームUI
  interface NewContactFormProps {
    form: NewContactForm;
    setForm: React.Dispatch<React.SetStateAction<NewContactForm>>;
    handleAdd: (org: Organization) => void;
    org: Organization;
  }
  const NewContactFormInput: React.FC<NewContactFormProps> = ({ form, setForm, handleAdd, org }) => {
    // フォームのハンドラー
    const handleChange = (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
      const target = e.target as HTMLInputElement;
      const { name, value, type, checked } = target;
      setForm(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    };

    return (
      <Box borderWidth={1} borderRadius="md" p={4}>
        <HStack spacing={2} mb={2}>
          <Input
            placeholder="姓"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
          />
          <Input
            placeholder="名"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
          />
        </HStack>

        <Input
          placeholder="役職"
          name="title"
          value={form.title}
          onChange={handleChange}
          mb={2}
        />

        <Textarea
          placeholder="担当者の説明"
          name="contactDescription"
          value={form.contactDescription}
          onChange={handleChange}
          mb={2}
        />

        <Checkbox
          name="keyPerson"
          isChecked={form.keyPerson}
          onChange={handleChange}
          mb={2}
        >
          キーパーソン
        </Checkbox>

        <Input
          placeholder="趣味"
          name="hobby"
          value={form.hobby}
          onChange={handleChange}
          mb={2}
        />

        <Input
          placeholder="家族構成"
          name="familyMember"
          value={form.familyMember}
          onChange={handleChange}
          mb={2}
        />

        <Input
          placeholder="前職"
          name="previousCareer"
          value={form.previousCareer}
          onChange={handleChange}
          mb={2}
        />

        <Input
          placeholder="専門分野"
          name="speciality"
          value={form.speciality}
          onChange={handleChange}
          mb={2}
        />

        <Input
          placeholder="好みのお酒"
          name="alcoholPreference"
          value={form.alcoholPreference}
          onChange={handleChange}
          mb={2}
        />

        <Input
          placeholder="好きな食べ物"
          name="foodPreference"
          value={form.foodPreference}
          onChange={handleChange}
          mb={4}
        />

        <Button colorScheme="blue" onClick={() => handleAdd(org)}>
          人員追加
        </Button>
      </Box>
    );
  };

  interface RenderNewContactModalProps {
    org: Organization;
  }

  const RenderNewContactModal: React.FC<RenderNewContactModalProps> = ({ org }) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    return (
      <>
        <Button onClick={onOpen}>人員追加</Button>
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>新規人員の追加</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <NewContactFormInput
                form={newContactForm}
                setForm={setNewContactForm}
                handleAdd={handleAddContactOrg}
                org={org}
              />
            </ModalBody>
          </ModalContent>
        </Modal>
      </>
    );
  };

  // ---------------------------------------
  // RE-LAYOUT WHEN ORG/CONTACT CHANGES
  // ---------------------------------------
  useEffect(() => {
    if (orgData && orgData.length > 0) {
      reLayout();
    }
  }, [orgData, contactData]);

  function reLayout() {
    // メインのツリー ( “NEW” を上位に持つ org は除外してツリー化 )
    const mainOrgs = orgData.filter(o => o.upperLevelOrgId !== 'NEW');
    const root = buildOrgTree(mainOrgs, contactData);
    const posRoot = layoutOrgTree(root);
    setPositionedRoot(posRoot);

    // NEW扱いの組織
    const newOrgs = orgData.filter(o => o.upperLevelOrgId === 'NEW');
    const newPos = layoutNewNodes(newOrgs);
    setPositionedNewNodes(newPos);
  }

  // ---------------------------------------
  // UPDATE
  // ---------------------------------------
  const updateContact = (updated: Contact) => {
    setContactData((prev: Contact[]) =>
      prev.map(c => (c.id === updated.id ? updated : c))
    );
    toast({ title: 'Contact updated locally (not saved)', status: 'info' });
  };

  function updateOrganization(updated: Organization) {
    setOrgData((prev: Organization[]) =>
      prev.map(o => (o.id === updated.id ? updated : o))
    );
    toast({ title: 'Organization updated locally (not saved)', status: 'info' });
  }

  // ---------------------------------------
  // ORG CREATE / DELETE
  // ---------------------------------------
  const handleAddOrganization = async () => {
    if (!newOrgName.trim()) return;
    const sorted = [...orgData].sort((a,b)=> a.siblingLevelOrgOrder - b.siblingLevelOrgOrder);
    const rootOrg = sorted.find(o => o.upperLevelOrgId === '');
    
    let upperLevelOrgId = "NEW";
    if (!rootOrg) {
      toast({
        title: 'No existing root found. Will place new org as root.',
        status: 'error',
        duration: 2000,
      });
      upperLevelOrgId = "";
    }

    const newId = `ORG-${uuidv4()}`;
    const newOrg: Organization = {
      id: newId,
      organizationName: newOrgName.trim(),
      upperLevelOrgId,
      siblingLevelOrgOrder: 9999,
      companyId: company.id,
      memo: ''
    };
    setOrgData([...orgData, newOrg]);
    setNewOrgName('');
    toast({ title: 'Org added locally (not saved)', status: 'info' });
  };

  function handleDeleteOrg(orgId: string) {
    // ローカル state から削除
    let newOrgs = orgData.filter((o) => o.id !== orgId);

    // 子組織 root化 など簡易処理
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
    toast({ title: 'Deleted org locally (not saved)', status: 'info' });
  }

  // ---------------------------------------
  // CONTACT CREATE
  // ---------------------------------------
  const handleAddContactOrg = async (org: Organization) => {
    const newId = `CONTACT_${uuidv4()}`;
    const newContact = {
      ...newContactForm,
      id: newId,
      belongingOrgId: org.id,
    };
    setContactData((prev) => [...prev, newContact]);
    setNewContactForm(initialContactForm);
    toast({ title: `Contact added locally to ${org.organizationName}`, status: 'info' });
  };

  // ---------------------------------------
  // DRAG / DROP
  // ---------------------------------------
  const dropEntity = (screenX: number, screenY: number) => {
    if (!draggingState || !positionedRoot) return;
    const { entityType, entityId } = draggingState;

    const { diagramX, diagramY } = screenToDiagramCoord(screenX, screenY);

    // ---- If we are dragging a Contact, check if we are over a Contact first! ----
    if (entityType === 'contact') {
      const contactHit = findContactAt([positionedRoot, ...positionedNewNodes], diagramX, diagramY);
      if (contactHit && contactHit.contactId !== entityId) {
        // We are dragging a contact over a different contact => reorder or move to that contact's org
        dropEntityForContact(entityId, contactHit.contactId, contactHit.orgId);
        return;
      }
      // Else: maybe we are over an Org box
      const overOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
      if (overOrgId) {
        dropContactOnOrg(entityId, overOrgId);
      }
      return;
    }

    // ---- Otherwise, it's an Org drag. Check for org bounding box. ----
    if (entityType === 'org') {
      const overOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
      if (!overOrgId) return; // not dropped on any org
      if (entityId === overOrgId) return; // same org => do nothing
      const dropTarget = orgData.find((o) => o.id === overOrgId);
      if (!dropTarget) {
        // means root?
        const org = orgData.find(o => o.id === entityId);
        if (!org) return;
        const updatedOrg: Organization = {
          ...org,
          upperLevelOrgId: '',
          siblingLevelOrgOrder: 9999,
          memo: org.memo,
        };
        updateOrganization(updatedOrg);
        return;
      }
      if (!dragOverMode) return;
      // もし先祖が子孫にドロップ なら無効
      if (isDescendant(positionedRoot, entityId, overOrgId)) {
        toast({
          title: 'Invalid drop',
          description: 'Cannot place an ancestor under its own descendant!',
          status: 'error',
          duration: 3000,
        });
        return;
      }
      // OK => reorder or parent
      const orgObj = orgData.find(o => o.id === entityId);
      if (!orgObj) return;
      dropEntityForOrg(orgObj, dropTarget, dragOverMode);
    }
  };

  // (A) Contact => Contact reorder or move
  function dropEntityForContact(dragContactId: string, dropContactId: string, dropContactOrgId: string) {
    // 1) get the real objects
    const dragContact = contactData.find(c => c.id === dragContactId);
    if (!dragContact) return;
    const dropContact = contactData.find(c => c.id === dropContactId);
    if (!dropContact) return;

    // If it's the same org => reorder
    if (dragContact.belongingOrgId === dropContact.belongingOrgId) {
      // We do the same “before/after/parent” logic for contact? 
      // Typically for contacts, we only do before/after. 
      // But let's replicate the same logic you used for Orgs:
      if (dragOverMode === 'parent') {
        // For a contact, "parent" mode can mean "just place it after the last sibling"? 
        // Or we can skip parent logic. But let's just do an example:
        normalContactParentLogic(dragContact, dropContactOrgId);
      } else if (dragOverMode === 'before') {
        insertContactBefore(dragContact, dropContact);
      } else if (dragOverMode === 'after') {
        insertContactAfter(dragContact, dropContact);
      }
    }
    else {
      // If different org => change parent org AND place near dropContact
      // (the same before/after logic)
      if (dragOverMode === 'parent') {
        // We can handle "parent" as "just move to that org, put last"
        normalContactParentLogic(dragContact, dropContactOrgId);
      }
      else if (dragOverMode === 'before') {
        contactMoveOrgThenInsertBefore(dragContact, dropContact);
      }
      else if (dragOverMode === 'after') {
        contactMoveOrgThenInsertAfter(dragContact, dropContact);
      }
    }
    // reLayout automatically with setContactData
  }

  // Helper: figure out if pointer is in "parent area" or "before" or "after"
  // For example, if orientation=horizontal, we can treat the "right 25%" of the contact's box as "parent"? 
  // For vertical, the "right side" might be "parent"? 
  // This can be as fancy or as simple as you want.
  // function decideContactDropMode(
  //   orientation: 'horizontal' | 'vertical',
  //   pointerX: number,
  //   dragContactId: string,
  //   dropContactId: string,
  //   dropContactOrgId: string
  // ): { mode: DragOverMode } {
  //   // For simplicity, we can re-use the same "dragOverMode" in state if you want.
  //   // But let's do a minimal approach:
  //   if (!dragOverMode) {
  //     // fallback
  //     return { mode: 'after' };
  //   }
  //   return { mode: dragOverMode };
  // }

  // function decideContactDropMode(
  //   orientation: 'horizontal' | 'vertical',
  //   pointerX: number,
  //   pointerY: number,
  //   rectX1: number,
  //   rectX2: number,
  //   rectY1: number,
  //   rectY2: number
  // ): 'before' | 'after' | 'parent' {
  //   const PARENT_MARGIN = 10; // 親にするためのエリアマージン
  
  //   if (orientation === 'horizontal') {
  //     //const width = rectX2 - rectX1;
  //     const parentThresholdLeft = rectX1 + PARENT_MARGIN;
  //     const parentThresholdRight = rectX2 - PARENT_MARGIN;
  
  //     if (pointerX < parentThresholdLeft) {
  //       return 'before';
  //     } else if (pointerX > parentThresholdRight) {
  //       return 'after';
  //     } else {
  //       return 'parent';
  //     }
  //   } else { // vertical
  //     //const height = rectY2 - rectY1;
  //     const parentThresholdTop = rectY1 + PARENT_MARGIN;
  //     const parentThresholdBottom = rectY2 - PARENT_MARGIN;
  
  //     if (pointerY < parentThresholdTop) {
  //       return 'before';
  //     } else if (pointerY > parentThresholdBottom) {
  //       return 'after';
  //     } else {
  //       return 'parent';
  //     }
  //   }
  // }
  

  // (B) If user drags Contact over an Org (no Contact hit), do "move to that org, last among siblings"
  function dropContactOnOrg(contactId: string, overOrgId: string) {
    const c = contactData.find(x => x.id === contactId);
    if (!c) return;
    // Typically we re-use dragOverMode => parent/before/after
    // But if we are not over a contact, there's no "before" or "after" => go parent
    const newOrg = orgData.find(o => o.id === overOrgId);
    if (!newOrg) return;

    // We'll do "normal parent logic" => place at the bottom
    normalContactParentLogic(c, newOrg.id);
  }

  // --- CONTACT reorder operations: same approach as ORG --- //

  // PARENT: just place the contact in the given org, with siblingOrder = max(siblings)+10
  function normalContactParentLogic(contact: Contact, newOrgId: string) {
    const siblings = contactData.filter(c => c.belongingOrgId === newOrgId);
    const maxOrder = siblings.reduce((acc, s) => Math.max(acc, s.siblingOrder), 0);
    const updated: Contact = {
      ...contact,
      belongingOrgId: newOrgId,
      siblingOrder: maxOrder + 10,
    };
    updateContact(updated);
    toast({ title: 'Contact -> new org (parent) done', status: 'info' });
  }

  // BEFORE: same org => contact.siblingOrder = dropTarget.siblingOrder - 1
  function insertContactBefore(dragContact: Contact, dropContact: Contact) {
    // same org
    if (dragContact.belongingOrgId !== dropContact.belongingOrgId) return; // safety
    const updated = {
      ...dragContact,
      siblingOrder: dropContact.siblingOrder - 1,
    };
    updateContact(updated);
    toast({ title: 'Contact Insert Before done', status: 'info' });
  }

  // AFTER: same org => contact.siblingOrder = dropTarget.siblingOrder + 1
  function insertContactAfter(dragContact: Contact, dropContact: Contact) {
    if (dragContact.belongingOrgId !== dropContact.belongingOrgId) return;
    const updated = {
      ...dragContact,
      siblingOrder: dropContact.siblingOrder + 1,
    };
    updateContact(updated);
    toast({ title: 'Contact Insert After done', status: 'info' });
  }

  // Move to new org THEN place "before" dropContact 
  function contactMoveOrgThenInsertBefore(dragContact: Contact, dropContact: Contact) {
    // 1) new org = dropContact.org
    // 2) siblingOrder = dropContact.siblingOrder - 1
    const updated = {
      ...dragContact,
      belongingOrgId: dropContact.belongingOrgId,
      siblingOrder: dropContact.siblingOrder - 1,
    };
    updateContact(updated);
    toast({ title: 'Contact moved Org & Insert Before done', status: 'info' });
  }

  // Move to new org THEN place "after" dropContact
  function contactMoveOrgThenInsertAfter(dragContact: Contact, dropContact: Contact) {
    const updated = {
      ...dragContact,
      belongingOrgId: dropContact.belongingOrgId,
      siblingOrder: dropContact.siblingOrder + 1,
    };
    updateContact(updated);
    toast({ title: 'Contact moved Org & Insert After done', status: 'info' });
  }

  // --- ORG reorder operations (unchanged) --- //
  function dropEntityForOrg(
    org: Organization,
    dropTarget: Organization,
    mode: DragOverMode
  ) {
    // orgIsLeaf?
    const orgIsLeaf = !orgData.some(child => child.upperLevelOrgId === org.id);
    const targetHasChildren = orgData.some(child => child.upperLevelOrgId === dropTarget.id);

    if (mode === 'parent') {
      if (targetHasChildren && orgIsLeaf) {
        insertBetweenLogic(org, dropTarget);
      } else {
        normalParentLogic(org, dropTarget);
      }
    } else if (mode === 'before') {
      insertBeforeLogic(org, dropTarget);
    } else if (mode === 'after') {
      insertAfterLogic(org, dropTarget);
    }
  }

  function normalParentLogic(org: Organization, dropTarget: Organization) {
    const newParentId = dropTarget.id;
    org = { ...org, upperLevelOrgId: newParentId };
    const siblings = orgData.filter(o => o.upperLevelOrgId === newParentId);
    const maxOrder = siblings.reduce((acc, s) => Math.max(acc, s.siblingLevelOrgOrder), 0);
    org.siblingLevelOrgOrder = maxOrder + 10;
    updateOrganization(org);
    toast({ title: 'Org -> new parent (normal)', status: 'info' });
  }

  function insertBetweenLogic(org: Organization, dropTarget: Organization) {
    const oldParentId = dropTarget.id;
    org.upperLevelOrgId = oldParentId || '';
    const siblings = orgData.filter(o => o.upperLevelOrgId === oldParentId);
    for (const sib of siblings) {
      if (sib.id === org.id) continue;
      sib.upperLevelOrgId = org.id;
    }
    updateOrganization({ ...org });
    setOrgData(prev =>
      prev.map(o => {
        if (o.id === org.id) {
          return { ...org };
        }
        if (siblings.some(s => s.id === o.id)) {
          const s2 = siblings.find(x => x.id === o.id)!;
          return { ...s2 };
        }
        return o;
      })
    );
    toast({ title: 'Org -> Inserted Between!', status: 'info' });
  }

  function insertBeforeLogic(org: Organization, dropTarget: Organization) {
    const newParentId = dropTarget.upperLevelOrgId || '';
    org = { ...org, upperLevelOrgId: newParentId };
    const newOrder = dropTarget.siblingLevelOrgOrder - 1;
    org.siblingLevelOrgOrder = newOrder;
    updateOrganization(org);
    toast({ title: 'Org -> Insert Before done', status: 'info' });
  }

  function insertAfterLogic(org: Organization, dropTarget: Organization) {
    const newParentId = dropTarget.upperLevelOrgId || '';
    org = { ...org, upperLevelOrgId: newParentId };
    const newOrder = dropTarget.siblingLevelOrgOrder + 1;
    org.siblingLevelOrgOrder = newOrder;
    updateOrganization(org);
    toast({ title: 'Org -> Insert After done', status: 'info' });
  }

  // ---------------------------------------
  // SVG HANDLERS
  // ---------------------------------------
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

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragCandidate || draggingState) return;
    isPanningRef.current = true;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    document.body.style.userSelect = 'none';
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanningRef.current) {
    // If you want to enable panning, handle it here
      return; // For now, pan disabled
    }

    // 1) Potentially start a drag if we moved far enough
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

    // 2) If we are actually dragging, we do highlight logic
    if (draggingState) {
      const { diagramX, diagramY } = screenToDiagramCoord(e.clientX, e.clientY);
      setDragX(e.clientX);
      setDragY(e.clientY);

      if (draggingState.entityType === 'org' && positionedRoot) {
        // Org highlight
        // the same as before:
        const overOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
        if (overOrgId && overOrgId !== draggingState.entityId) {
          setDragOverOrgId(overOrgId);
          setDragOverContactId(null);
          const node = findPositionedNode(positionedRoot, overOrgId);
          if (node) {
            const thresholdX = node.x + node.width * 0.75;
            if (diagramX > thresholdX) {
              setDragOverMode('parent');
            } else {
              // compare with center Y
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
          setDragOverOrgId(null);
          setDragOverContactId(null);
          setDragOverMode(null);
        }
      }
      else if (draggingState.entityType === 'contact'&&positionedRoot) {
        // ★★ ADDED for CONTACT REORDER ★★
        //  first see if we are over some contact
        const contactHit = findContactAt([positionedRoot, ...positionedNewNodes], diagramX, diagramY);
        if (contactHit && contactHit.contactId !== draggingState.entityId) {
          setDragOverContactId(contactHit.contactId);
          setDragOverOrgId(null);

          // Decide mode: parent/before/after
          if (contactHit.orientation === 'horizontal') {
            // for horizontal, compare pointerX with the midpoint
            const midX = (contactHit.rectX1 + contactHit.rectX2) / 2;
            if (diagramX < midX) {
              setDragOverMode('before');
            } else {
              setDragOverMode('after');
            }
          } else {
            // vertical => compare pointerY with midpoint
            const midY = (contactHit.rectY1 + contactHit.rectY2) / 2;
            if (diagramY < midY) {
              setDragOverMode('before');
            } else {
              setDragOverMode('after');
            }
          }
        } else {
          // maybe we are over an org?
          const overOrgId = findOrgNodeAt(positionedRoot, diagramX, diagramY);
          if (overOrgId) {
            setDragOverOrgId(overOrgId);
            setDragOverContactId(null);
            // we can say "parent" if pointer in the right side. 
            const node = findPositionedNode(positionedRoot, overOrgId);
            if (node) {
              const thresholdX = node.x + node.width * 0.75;
              if (diagramX > thresholdX) {
                setDragOverMode('parent');
              } else {
                const centerY = node.y + node.height / 2;
                if (diagramY < centerY) {
                  setDragOverMode('before');
                } else {
                  setDragOverMode('after');
                }
              }
            }
          } else {
            setDragOverOrgId(null);
            setDragOverContactId(null);
            setDragOverMode(null);
          }
        }
      }
    }
  };

  const onSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isPanningRef.current = false;
    document.body.style.userSelect = 'auto';

    if (draggingState) {
      dropEntity(e.clientX, e.clientY);
      setDraggingState(null);
      setDragCandidate(null);

      // Clear highlight
      setDragOverOrgId(null);
      setDragOverContactId(null);
      setDragOverMode(null);
      return;
    }

    // (Click)
    if (dragCandidate) {
      if (dragCandidate.entityType === 'contact') {
        const c = contactData.find(x => x.id === dragCandidate.entityId);
        if (c) {
          setSelectedEntity({ type: 'contact', id: c.id });
          onOpen();
        }
      } else {
        const o = orgData.find(x => x.id === dragCandidate.entityId);
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
    setDragOverOrgId(null);
    setDragOverContactId(null);
    setDragOverMode(null);
    document.body.style.userSelect = 'auto';
  };

  const MIN_SCALE = 0.2;
  const MAX_SCALE = 5.0;

  // Zoom In/Out
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, MAX_SCALE));
  };
  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, MIN_SCALE));
  };

  // ---------------------------------------
  // RENDER
  // ---------------------------------------
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
                  setSelectedEntity({ type: 'org', id: pNode.org.id });
                  onOpen();
                }}
              />
              <text x={10} y={20} fontSize={14} fill="#000">
                {pNode.org.organizationName} (NEW)
              </text>

              {/* drag handle */}
              <foreignObject
          x={pNode.width - 24}
          y={5}
          width={25}
          height={25}
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
        >
          <GripVertical 
            size={20} 
            color="#888" 
            style={{ 
              pointerEvents: 'none', 
              width: '100%', 
              height: '100%' 
            }} 
          />
        </foreignObject>
            </g>
          );
        })}
      </>
    );
  }

  function renderOrgBox(node: PositionedNode) {
    const onOrgBoxClick = (e: React.MouseEvent<SVGRectElement>) => {
      e.stopPropagation();
      setSelectedEntity({ type: 'org', id: node.org.id });
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

        {/* Org drag handle */}
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
          <GripVertical 
            size={20} 
            color="#888" 
            style={{ 
              pointerEvents: 'none', 
              width: '100%', 
              height: '100%' 
            }} 
          />
        </foreignObject>

        {/* highlight for Org reordering */}
        {(dragOverOrgId === node.org.id &&
          draggingState?.entityType === 'org' &&
          draggingState.entityId !== node.org.id) && (
          <InsertionIndicator node={node} mode={dragOverMode} />
        )}

        {node.children.length === 0
          ? renderContactsHorizontal(node)
          : renderContactsVertical(node)}
      </g>
    );
  }

  // ---------------------------------------
  // CONTACT RENDER
  // ---------------------------------------
  function renderContactsVertical(node: PositionedNode) {
    const contactHeight = CONTACT_BOX_HEIGHT;
    const gap = CONTACT_BOX_GAP;
    const paddingX = 10;

    let cumulativeY = BOX_TOP_PADDING - 5;

    // Sort by siblingOrder
    const sortedContacts = [...node.contacts].sort((a,b) => a.siblingOrder - b.siblingOrder);

    return sortedContacts.map((contact) => {
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

          {/* ★★ show insertion highlight if this contact is the "dragOverContactId" */}
          {(dragOverContactId === contact.id &&
            draggingState?.entityType === 'contact' &&
            draggingState.entityId !== contact.id) && (
            <ContactInsertionIndicator
              contactWidth={contactWidth}
              contactHeight={contactHeight}
              mode={dragOverMode}
              orientation="vertical"
            />
          )}
        </g>
      );
    });
  }

  function renderContactsHorizontal(node: PositionedNode) {
    const contactHeight = CONTACT_BOX_HEIGHT;
    const gap = 5;
    const paddingX = 5;

    let cumulativeX = 10;
    const sortedContacts = [...node.contacts].sort((a,b) => a.siblingOrder - b.siblingOrder);

    return sortedContacts.map((contact) => {
      const label = truncateContactLabel(contact);
      const textWidth = measureTextWidth(label);
      const contactWidth = textWidth + paddingX * 2;

      const currentX = cumulativeX;
      cumulativeX += contactWidth + gap;
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

          {(dragOverContactId === contact.id &&
            draggingState?.entityType === 'contact' &&
            draggingState.entityId !== contact.id) && (
            <ContactInsertionIndicator
              contactWidth={contactWidth}
              contactHeight={contactHeight}
              mode={dragOverMode}
              orientation="horizontal"
            />
          )}
        </g>
      );
    });
  }

  // Indicate if a contact has an opportunity
  function contactHasOpportunity(contactId: string): boolean {
    return opportunityData.some(opp => opp.contactId === contactId);
  }
  // Count how many activities a contact has
  function getActivityCount(contactId: string): number {
    return activityData.filter(act => act.contactId === contactId).length;
  }

  // ---------------------------------------
  // INSERTION INDICATOR
  // ---------------------------------------
  const InsertionIndicator: React.FC<{ node: PositionedNode; mode: DragOverMode }> = ({ node, mode }) => {
    if (!mode) return null;
    const margin = 6;
    if (mode === 'parent') {
      return (
        <line
          x1={node.width + margin}
          y1={0}
          x2={node.width + margin}
          y2={node.height}
          stroke="green"
          strokeWidth={10}
          pointerEvents="none"
        />
      );
    }
    else if (mode === 'before') {
      return (
        <line
          x1={0}
          y1={0 - margin}
          x2={node.width}
          y2={0 - margin}
          stroke="green"
          strokeWidth={10}
          pointerEvents="none"
        />
      );
    }
    else if (mode === 'after') {
      return (
        <line
          x1={0}
          y1={node.height + margin}
          x2={node.width}
          y2={node.height + margin}
          stroke="green"
          strokeWidth={10}
          pointerEvents="none"
        />
      );
    }
    return null;
  };

  // ★★ ADDED for CONTACT REORDER: a small indicator around a single contact box
  const ContactInsertionIndicator: React.FC<{
    contactWidth: number;
    contactHeight: number;
    mode: DragOverMode;
    orientation: 'horizontal'|'vertical';
  }> = ({ contactWidth, contactHeight, mode, orientation }) => {
    if (!mode) return null;
    const margin = 4;
    if (mode === 'parent') {
      // you can decide what "parent" means for a contact
      // for example, show a line at the right side
      return (
        <line
          x1={contactWidth + margin}
          y1={0}
          x2={contactWidth + margin}
          y2={contactHeight}
          stroke="green"
          strokeWidth={6}
          pointerEvents="none"
        />
      );
    }
    else if (mode === 'before') {
      if (orientation === 'vertical') {
        return (
          <line
            x1={0}
            y1={0 - margin}
            x2={contactWidth}
            y2={0 - margin}
            stroke="green"
            strokeWidth={6}
            pointerEvents="none"
          />
        );
      } else {
        // horizontal => line on left side
        return (
          <line
            x1={0 - margin}
            y1={0}
            x2={0 - margin}
            y2={contactHeight}
            stroke="green"
            strokeWidth={6}
            pointerEvents="none"
          />
        );
      }
    }
    else if (mode === 'after') {
      if (orientation === 'vertical') {
        return (
          <line
            x1={0}
            y1={contactHeight + margin}
            x2={contactWidth}
            y2={contactHeight + margin}
            stroke="green"
            strokeWidth={6}
            pointerEvents="none"
          />
        );
      } else {
        // horizontal => line on right side
        return (
          <line
            x1={contactWidth + margin}
            y1={0}
            x2={contactWidth + margin}
            y2={contactHeight}
            stroke="green"
            strokeWidth={6}
            pointerEvents="none"
          />
        );
      }
    }
    return null;
  };

  // ---------------------------------------
  // DRAG GHOST
  // ---------------------------------------
  const renderDragGhost = () => {
    if (!draggingState) return null;
    const { entityType, entityId } = draggingState;

    if (entityType === 'contact') {
      const c = contactData.find(x => x.id === entityId);
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
      const o = orgData.find(oo => oo.id === entityId);
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

  // ---------------------------------------
  // MODAL
  // ---------------------------------------
  const renderModalContent = () => {
    if (!selectedEntity) return null;

    if (selectedEntity.type === 'org') {
      const org = orgData.find(o => o.id === selectedEntity.id);
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
            <RenderNewContactModal org={org} />
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
    } else {
      const c = contactData.find(x => x.id === selectedEntity.id);
      if (!c) return <Box>Not found</Box>;
      return (
        <ContactPage
          contact={c}
          onClose={onClose}
          onAddActivity={newActivity => {
            setActivityData(prev => [...prev, newActivity]);
          }}
          onAddOpportunity={newOpp => {
            setOpportunityData(prev => [...prev, newOpp]);
          }}
          activities={activityData}
          opportunities={opportunityData}
        />
      );
    }
  };

  // ---------------------------------------
  // RENDER MAIN
  // ---------------------------------------
  return (
    <Box p={4}>
      <Box as="h1" fontSize="xl" mb={4}>
        {company.companyName}
      </Box>
      <Button onClick={handleZoomIn} mr={1} w="30px" h="30px" borderRadius="full">
        ＋
      </Button>
      <Button onClick={handleZoomOut} mr={1} w="30px" h="30px" borderRadius="full">
        －
      </Button>

      <Box>
        <Input
          placeholder="新しい組織名"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
          width="200px"
          mr={2}
        />
        <Button onClick={handleAddOrganization} mr={10}>
          組織追加
        </Button>
      </Box>

      <Box
        border="1px solid #ccc"
        position="relative"
        w={`${svgWidth}px`}
        h={`${svgHeight}px`}
        mt={4}
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
        <ModalContent>{renderModalContent()}</ModalContent>
      </Modal>
    </Box>
  );
};

export default CompanyComponent;