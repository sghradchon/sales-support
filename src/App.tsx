import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { Box, Button, Flex } from '@chakra-ui/react';
import MakeProductSlidePage from './pages/MakeProductSlidePage';
import SalesHeatMapPage from './pages/SalesHeatMapPage';
import ProductSlideCreation from './pages/ProductSlideCreation';


const App: React.FC = () => {
  return (
    <Router>
      <Box>
        {/* メニューバー */}
        <Flex bg="teal.500" p={4} justifyContent="space-around">
        <Link to="/ProductSlidePage">
            <Button colorScheme="red" variant="outline">MAKE SLIDE</Button>
          </Link>
          <Link to="/salesHeatMapPage">
            <Button colorScheme="teal" variant="outline">SALES HEATMAP</Button>
          </Link>
        </Flex>
        {/* ルーティングの設定 */}
        <Routes>
          <Route path="/ProductSlidePage" element={<ProductSlideCreation />} />
          <Route path="/salesHeatMapPage" element={<SalesHeatMapPage />} />

        </Routes>
      </Box>
    </Router>
  );
};

export default App;