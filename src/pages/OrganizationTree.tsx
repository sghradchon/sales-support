import React, { useState, useEffect } from "react";
import Tree, { RawNodeDatum } from "react-d3-tree";
import { Box } from "@chakra-ui/react";
import ContactCard from "./ContactCard";

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

interface TreeNode extends RawNodeDatum {
  attributes: Record<string, string | number | boolean>;
  contacts?: Contact[];
  children?: TreeNode[];
  y?: number; // 👈 追加: Y座標を保持
}
interface Props {
  organizations: Organization[];
  contacts: Contact[];
}

const transformData = (
  organizations: Organization[],
  contacts: Contact[],
  parentId: string = "",
  parentY: number = 0
): TreeNode[] => {
  const children = organizations
    .filter(org => org.upperLevelOrgId === parentId)
    .map((org, index, array) => {
      const orgContacts = contacts.filter(contact => contact.organizationId === org.organizationId);
      
      // 親ノードのYを基準にする
      const isFirstChild = index === 0;
      const yOffset = isFirstChild ? 0 : 100; // 2番目以降の子ノードは100pxずつ下に配置
      
      const subChildren = transformData(organizations, contacts, org.organizationId, parentY + yOffset);

      return {
        name: org.organizationName,
        attributes: { memo: org.memo, contactCount: orgContacts.length },
        contacts: orgContacts,
        children: subChildren.length > 0 ? subChildren : undefined,
        y: parentY + yOffset, // 🚀 親ノードを基準に相対配置
      };
    });

  return children;
};
const OrganizationTree: React.FC<Props> = ({ organizations, contacts }) => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);

  useEffect(() => {
    if (organizations.length > 0 && contacts.length > 0) {
      setTreeData(transformData(organizations, contacts, ""));
    }
  }, [organizations, contacts]);

  const customPathFunc = (linkData: any, orientation: "horizontal" | "vertical") => {
    const { source, target } = linkData;
  
    // 親ノードの座標
    const sx = source.x;
    const sy = source.y;
  
    // 子ノードの座標
    let tx = target.x;
    console.log("tx,ty = ",target.x, target.y)
    let ty = source.y; // 子ノード1のY座標を親と同じに
  
    // 子ノード2以降は親ノードの下に配置
    if (target.parent.children && target.parent.children.length > 1) {
      const index = target.parent.children.indexOf(target);
      ty += index * 100; // 80px 間隔で配置

      console.log("sy, ty = ", sy, ty)
    }
    
  
    return `M ${sx},${sy} L ${tx},${ty}`;
  };

  return (
    <Box width="100%" height="80vh">
      {treeData.length > 0 && (
        <Tree
          data={treeData}
          orientation="horizontal"
          translate={{ x: 100, y: 100 }}
          pathFunc="step"//{customPathFunc} // 👈 カスタムパスを適用
          nodeSize={{ x: 300, y: 100 }}
          separation={{ siblings: 1.5, nonSiblings: 2.5 }}
          renderCustomNodeElement={({ nodeDatum }) => {
            const typedNodeDatum = nodeDatum as TreeNode;
            return (
              <g transform={`translate(0, ${typedNodeDatum.y || 0})`}> {/* 👈 Y座標を修正 */}
                <rect
                  x="-75"
                  y="-30"
                  width={150 + ((typedNodeDatum.contacts?.length || 0) * 130)}
                  height={80}
                  fill="lightgray"
                  stroke="black"
                  rx="5"
                />
                <text x="0" y="-15" textAnchor="middle" fontSize="12" fontWeight="bold" fill="black">
                  {typedNodeDatum.name}
                </text>
                {typedNodeDatum.contacts?.map((contact, index) => (
                  <foreignObject key={contact.contactId} x={-60 + index * 130} y={0} width="120" height="50">
                    <ContactCard contact={contact} />
                  </foreignObject>
                ))}
              </g>
            );
          }}
        />
      )}
    </Box>
  );
};

export default OrganizationTree;
