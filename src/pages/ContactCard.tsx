import React from "react";
import { Box, Text } from "@chakra-ui/react";



interface Contact {
  contactId: string;
  lastName: string;
  firstName: string;
  organizationId: string;
  title: string;
  contactLevel: number;
  contactDescription: string;
}

interface Props {
  contact: Contact;
}

const getContactLevelColor = (level: number) => {
  const colors = [
    "blue.100", // Level 0
    "blue.200", // Level 1
    "blue.300", // Level 2
    "blue.400", // Level 3
    "blue.500", // Level 4
    "blue.600"  // Level 5
  ];
  return colors[level] || "blue.100";
};





const ContactCard: React.FC<Props> = ({ contact }) => {
  return (
    <Box
      p={2}
      borderRadius="md"
      boxShadow="md"
      bg={getContactLevelColor(contact.contactLevel)}
      border="1px solid"
      width="120px"
      height="40px"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Text fontSize="xs" textAlign="center">
        {contact.lastName} {contact.firstName} ({contact.title})
      </Text>
    </Box>
  );
};

export default ContactCard;
