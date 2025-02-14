import React from "react";
import { Box, Heading, Spinner, Text } from "@chakra-ui/react";
// import OrganizationTree from "./OrganizationTree";
import OrganizationTreeSelf from "./OrganizationTreeSelf";
import useSalesData from "../hooks/useSalesData";

const SalesHeatMapPage: React.FC = () => {
  const { organizations, contacts, isLoading, error } = useSalesData();

  if (isLoading) 
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );

  if (error) 
    return (
      <Box textAlign="center" p={4} color="red.500">
        <Text fontSize="lg">Error loading data</Text>
      </Box>
    );

  return (
    <Box maxW="container.lg" mx="auto" p={4}>
      <Heading as="h1" size="xl" mb={4}>Sales Heatmap</Heading>
      {/* ルート組織を明示的に表示 */}
      <OrganizationTreeSelf organizations={organizations} contacts={contacts} />
    </Box>
  );
};

export default SalesHeatMapPage;