import React, { useState, useEffect } from "react";
import { uploadData, list } from "aws-amplify/storage";
import { StorageImage } from "@aws-amplify/ui-react-storage";
import {
  Box,
  Button,
  Input,
  VStack,
  Grid,
  Heading,
  Text,
} from "@chakra-ui/react";
import { v4 as uuidv4 } from "uuid"; // ✅ UUID ライブラリを追加

// 画像表示コンポーネント
const ShowStorageImage: React.FC<{ path: string }> = ({ path }) => {
  return (
    <Box boxShadow="md" borderRadius="md" overflow="hidden">
      <StorageImage alt="S3 Image" path={path} />
    </Box>
  );
};

const MakeProductSlidePage: React.FC = () => {
  const [productPaths, setProductPaths] = useState<string[]>([]);
  const [partsPaths, setPartsPaths] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedProductFile, setSelectedProductFile] = useState<File | null>(null);
  const [selectedPartFile, setSelectedPartFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // ✅ 製品画像リストを取得
  const getProductList = async () => {
    try {
      const result = await list({
        path: "products-pictures/",
        options: { listAll: true },
      });
      const paths = result.items.map((item) => item.path);
      setProductPaths(paths);
      setMessage(`${paths.length} 件の製品画像を取得しました`);
    } catch (error) {
      console.error("製品リスト取得失敗:", error);
      setMessage("製品画像の取得に失敗しました");
    }
  };

  // ✅ 部品画像リストを取得
  const getPartsList = async (productPath: string) => {
    const productName = productPath.split("/").pop()?.split("-")[1]?.split(".")[0]; // UUID-元のファイル名 から製品名を取得
    if (!productName) return;

    try {
      const result = await list({
        path: `parts-pictures/${productName}/`,
        options: { listAll: true },
      });
      const paths = result.items.map((item) => item.path);
      setPartsPaths(paths);
      setSelectedProduct(productName);
      setMessage(`「${productName}」の部品画像を取得しました`);
    } catch (error) {
      console.error("部品リスト取得失敗:", error);
      setMessage("部品画像の取得に失敗しました");
    }
  };

  // ✅ 製品画像のアップロード（UUID 付き）
  const uploadProductImage = async () => {
    if (!selectedProductFile) return;
    const fileName = `${uuidv4()}-${selectedProductFile.name}`; // UUID 付きファイル名
    const uploadPath = `products-pictures/${fileName}`;

    try {
      await uploadData({ path: uploadPath, data: selectedProductFile });
      setMessage(`製品「${fileName}」をアップロードしました`);
      setSelectedProductFile(null);
      getProductList(); // アップロード後にリスト更新
    } catch (error) {
      console.error("アップロード失敗:", error);
      setMessage("製品画像のアップロードに失敗しました");
    }
  };

  // ✅ 部品画像のアップロード（UUID 付き）
  const uploadPartsImage = async (productPath: string) => {
    const productName = productPath.split("/").pop()?.split("-")[1]?.split(".")[0]; // UUID-元のファイル名 から製品名を取得
    if (!productName || !selectedPartFile) return;

    const fileName = `${uuidv4()}-${selectedPartFile.name}`; // UUID 付きファイル名
    const uploadPath = `parts-pictures/${productName}/${fileName}`;

    try {
      await uploadData({ path: uploadPath, data: selectedPartFile });
      setMessage(`${fileName} を「${productName}」の部品としてアップロードしました`);
      setSelectedPartFile(null);
      getPartsList(productPath); // アップロード後にリスト更新
    } catch (error) {
      console.error("アップロード失敗:", error);
      setMessage("部品画像のアップロードに失敗しました");
    }
  };

  // ✅ 初回ロード時に製品リストを取得
  useEffect(() => {
    getProductList();
  }, []);

  return (
      <VStack spacing={6} p={6}>
        <Heading size="lg">S3 Image Upload & Display</Heading>

        {/* 通知メッセージ */}
        {message && (
          <Box p={3} bg="gray.100" borderRadius="md">
            <Text>{message}</Text>
          </Box>
        )}

        {/* 製品画像のアップロード */}
        <Heading size="md">製品をアップロード</Heading>
        <Input type="file" onChange={(e) => setSelectedProductFile(e.target.files?.[0] || null)} />
        <Button colorScheme="blue" onClick={uploadProductImage} disabled={!selectedProductFile}>
          製品をアップロード
        </Button>

        {/* 製品画像リスト */}
        <Heading size="md">製品一覧</Heading>
        <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
          {productPaths.map((path, index) => (
            <Box key={index} p={4} borderWidth="1px" borderRadius="lg">
              <ShowStorageImage path={path} />
              <VStack mt={2} spacing={2}>
                {/* 部品アップロード */}
                <Input
                  type="file"
                  onChange={(e) => setSelectedPartFile(e.target.files?.[0] || null)}
                />
                <Button
                  colorScheme="blue"
                  size="sm"
                  disabled={!selectedPartFile}
                  onClick={() => uploadPartsImage(path)}
                >
                  部品をアップロード
                </Button>

                {/* 部品画像表示 */}
                <Button colorScheme="teal" size="sm" onClick={() => getPartsList(path)}>
                  部品画像を表示
                </Button>
              </VStack>
            </Box>
          ))}
        </Grid>

        {/* 部品画像リスト */}
        {selectedProduct && (
          <>
            <Heading size="md">{selectedProduct} の部品一覧</Heading>
            <Grid templateColumns="repeat(auto-fill, minmax(150px, 1fr))" gap={4}>
              {partsPaths.map((path, index) => (
                <ShowStorageImage key={index} path={path} />
              ))}
            </Grid>
          </>
        )}
      </VStack>
  );
};

export default MakeProductSlidePage;