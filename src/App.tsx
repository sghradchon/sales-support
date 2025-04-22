import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { Box, Button, Flex } from '@chakra-ui/react';
import SalesHeatMapPage from './pages/SalesHeatMapPage';
import ProductSlideCreation from './pages/ProductSlideCreation';
import TextsClustering from './pages/TextsClustering';
import CompanyLinkPage from './pages/CompanyLinkPage';

const App: React.FC = () => {
  return (
    <Router>
      <Box>
        {/* メニューバー */}
        <Flex bg="teal.500" p={4} justifyContent="space-around">
        <Link to="/ProductSlidePage">
            <Button colorScheme="teal" variant="outline">MAKE SLIDE</Button>
          </Link>
          <Link to="/salesHeatMapPage">
            <Button colorScheme="teal" variant="outline">SALES HEATMAP</Button>
          </Link>
          <Link to="/CompanyLinkPage">
            <Button colorScheme="teal" variant="outline">COMPANY LINK</Button>
          </Link>
          <Link to="/TextsClustering">
            <Button colorScheme="teal" variant="outline">Texts Clustering</Button>
          </Link>

        </Flex>
        {/* ルーティングの設定 */}
        <Routes>
          <Route path="/ProductSlidePage" element={<ProductSlideCreation />} />
          <Route path="/salesHeatMapPage" element={<SalesHeatMapPage />} />
          <Route path="/TextsClustering" element={<TextsClustering />} />
          <Route path="/CompanyLinkPage" element={<CompanyLinkPage />} />

        </Routes>
      </Box>
    </Router>
  );
};

export default App;