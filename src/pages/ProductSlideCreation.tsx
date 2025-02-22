import React, { useState, useEffect } from 'react';
import {
  Button,
  Checkbox,
  Box,
  VStack,
  Text,
  HStack
} from '@chakra-ui/react';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import outputs from "../../amplify_outputs.json";

// AmplifyのStorage機能を使用
import { list } from 'aws-amplify/storage';
import { StorageImage } from '@aws-amplify/ui-react-storage';

// Cognito認証情報の取得
import { fetchAuthSession } from 'aws-amplify/auth';

const awsRegion = outputs.auth.aws_region;
const functionName = outputs.custom.makeslide_pipeFunctionName;

interface ProductFile {
  s3path:string;
  baseName: string;    // 拡張子を除いたファイル名 (例: "image01")    // 画像プレビュー表示用に生成した Blob URL
}

const ProductSlideCreation: React.FC = () => {
  // S3から取得したファイル情報
  const [files, setFiles] = useState<ProductFile[]>([]);
  // 選択されたファイル名(baseName)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [slideUrl,setSlideUrl] = useState<string>("");
  // =========================
  // (1) 初期ロード時に S3 の files を取得
  // =========================
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        // "products/" フォルダ配下のファイル一覧を取得
        const listResult = await list({
          path: 'products/',
          options: {
            listAll: true,
          }
        });
        console.log(listResult)
        // 各ファイルをダウンロード(Blob取得)し、ブラウザで表示できるURLを作る
        const processedFiles: ProductFile[] = [];
        for (const item of listResult.items) {
          let s3path = item.path
          let basename = s3path.split("/").pop()?.split(".")[0] || "";
          if (basename){
            processedFiles.push({
              s3path:s3path,
              baseName:basename
            });
          }
        }
        setFiles(processedFiles);
      } catch (error) {
        console.error('Error listing product images:', error);
      }
    };

    fetchFiles();
  }, []);

  // =========================
  // (2) チェックボックスが変更されたとき
  // =========================
  const handleCheckboxChange = (baseName: string, checked: boolean) => {
    setSelectedProductIds((prev) =>
      checked ? [...prev, baseName] : prev.filter((p) => p !== baseName)
    );
  };

  // =========================
  // (3) Lambda呼び出し
  // =========================
  const trigger_lambda = async (productIds: string[]) => {
    const { credentials } = await fetchAuthSession();

    const body = {
      productIds: productIds,
    };
    console.log("body: ", body);

    // LambdaClient を作成
    const lambda = new LambdaClient({ credentials, region: awsRegion });

    // InvokeCommand で Lambda を呼び出す
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({ body }),
    });

    const response = await lambda.send(command);
    if (response.Payload) {
      const rawPayload = new TextDecoder().decode(response.Payload);
      console.log("rawPayload:", rawPayload);

      // Payload が二重JSONの場合、2回パース
      const parsedPayload = JSON.parse(rawPayload);
      console.log("parsedPayload:", parsedPayload);

      const reparsedPayload = JSON.parse(parsedPayload);
      return reparsedPayload;
    } else {
      return undefined;
    }
  };

  // =========================
  // (4) スライド生成ボタン
  // =========================
  const createSlides = async () => {
    try {
      const payload = await trigger_lambda(selectedProductIds);
      console.log("payload", payload);

      if (payload) {
        const message = payload.message;
        console.log("message:", message);
        if (message === "success") {
          const slideUrl = payload.slideUrl;
          setSlideUrl(slideUrl)
          console.log("slideUrl:", slideUrl);
          // スライドURLを別タブで開く
          window.open(slideUrl, '_blank');
        } else {
          alert('スライドURLが返されませんでした。');
        }
      } else {
        alert('LambdaからのPayloadが空でした。');
      }
    } catch (error) {
      console.error(error);
      alert('スライド作成中にエラーが発生しました。');
    }
  };

  const handleSlideUrlClick = () => {
    if (slideUrl) {
      window.open(slideUrl, "_blank"); // 新しいタブで開く
    }
  };

  // =========================
  // (5) 画面描画
  // =========================
  return (
    <Box p={6}>
      <Text fontSize="2xl" mb={4}>製品スライド作成</Text>
      {slideUrl&&<Button colorScheme="blue" mt={6} onClick={handleSlideUrlClick}>
        スライドができました
      </Button>}
      <VStack align="start" spacing={4}>
        {files.length === 0 ? (
          <Text>Loading files from S3...</Text>
        ) : (
          files.map((file) => (
            <HStack key={file.baseName} spacing={3}>
              <Checkbox
                onChange={(e) => handleCheckboxChange(file.baseName, e.target.checked)}
              >
                {/* Checkbox のラベルに baseName を表示 */}
                {file.baseName}
              </Checkbox>

              {/* Blob URL があれば画像プレビューを表示 */}
              {file && (
                <StorageImage alt="cat" path={file.s3path} />
              )}
            </HStack>
          ))
        )}
      </VStack>

      <Button colorScheme="blue" mt={6} onClick={createSlides}>
        スライドを作成
      </Button>


    </Box>
  );
};

export default ProductSlideCreation;