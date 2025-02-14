import React, { useState, useEffect } from "react";
import { Box } from "@chakra-ui/react";
import { JSX } from "react/jsx-runtime";

interface Organization {
  organizationId: string;
  organizationName: string;
  upperLevelOrgId: string;
  memo: string;
}

interface Contact {
  contactId: string;
  lastName: string;
  firstName: string;
  organizationId: string;
  title: string;
  contactLevel: number;
  contactDescription: string;
}

interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  children?: TreeNode[];
  contacts: Contact[];
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const HORIZONTAL_SPACING = 250;
const VERTICAL_SPACING = 120;

const transformData = (
  organizations: Organization[],
  contacts: Contact[],
  parentId: string = "", // 👈 null ではなく "" に修正
  level = 0
): TreeNode[] => {
  console.log(`🔍 Filtering organizations where upperLevelOrgId === "${parentId}"`);
  const filteredOrgs = organizations.filter(org => org.upperLevelOrgId === parentId);
  console.log("🔍 Filtered Organizations:", filteredOrgs);

  return filteredOrgs.map(org => {
    const nodeContacts = contacts.filter(contact => contact.organizationId === org.organizationId);
    const children = transformData(organizations, contacts, org.organizationId, level + 1);

    console.log(`📌 Creating node for ${org.organizationName} with ID: ${org.organizationId}, Children Count: ${children.length}`);

    return {
      id: org.organizationId,
      name: org.organizationName,
      parentId,
      level,
      contacts: nodeContacts,
      children: children.length > 0 ? children : undefined, // 空の `children` を除外
    };
  });
};

const renderNodes = (nodes: TreeNode[], parentX = 0, parentY = 0, level = 0): JSX.Element[] => {
  return nodes.flatMap((node, index) => {
    const x = level * HORIZONTAL_SPACING;
    const y = index * VERTICAL_SPACING + parentY;

    return [
      // ノード本体の描画
      <g key={node.id} transform={`translate(${x}, ${y})`}>
        <rect width={NODE_WIDTH} height={NODE_HEIGHT} fill="lightgray" stroke="black" rx="5" />
        <text x={NODE_WIDTH / 2} y={20} textAnchor="middle" fontSize="14" fontWeight="bold">
          {node.name}
        </text>
        {node.contacts.map((contact, i) => (
          <text key={contact.contactId} x={10} y={40 + i * 15} fontSize="12">
            {contact.lastName} {contact.firstName} ({contact.title})
          </text>
        ))}
      </g>,

      // 再帰的に子ノードを描画
      ...(node.children ? renderNodes(node.children, x + HORIZONTAL_SPACING, y, level + 1) : [])
    ];
  });
};

const drawLines = (nodes: TreeNode[], parentX = 0, parentY = 0, level = 0): JSX.Element[] => {
  let lines: JSX.Element[] = [];

  nodes.forEach((node, index) => {
    const x = level * HORIZONTAL_SPACING;
    const y = index * VERTICAL_SPACING + parentY;

    if (node.children) {
      node.children.forEach((child, childIndex) => {
        const childX = (level + 1) * HORIZONTAL_SPACING;
        const childY = childIndex * VERTICAL_SPACING + parentY;

        lines.push(
          <line
            key={`${node.id}-${child.id}`}
            x1={x + NODE_WIDTH / 2}
            y1={y + NODE_HEIGHT}
            x2={childX + NODE_WIDTH / 2}
            y2={childY}
            stroke="black"
          />
        );
      });

      lines = [...lines, ...drawLines(node.children, x + HORIZONTAL_SPACING, y, level + 1)];
    }
  });

  return lines;
};
const OrganizationTreeSelf: React.FC<{ organizations: Organization[], contacts: Contact[] }> = ({ organizations, contacts }) => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);

  useEffect(() => {
    if (organizations.length > 0 && contacts.length > 0) {
      const transformedData = transformData(organizations, contacts);
      console.log("Transformed Data:", transformedData);
      setTreeData(transformedData);
    }
  }, [organizations, contacts]);

  return (
    <Box width="100%" height="80vh">
      <svg width="1500" height="1500">
        {treeData.length > 0 && drawLines(treeData)}
        {treeData.length > 0 && renderNodes(treeData)}
      </svg>
    </Box>
  );
};
export default OrganizationTreeSelf;