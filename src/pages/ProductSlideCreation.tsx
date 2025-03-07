import React, { useState, useEffect } from 'react';
import {
  Button,
  Checkbox,
  Box,
  VStack,
  Text,
  HStack
} from '@chakra-ui/react';
// import { createCanvas } from 'canvas';
import { uploadData } from 'aws-amplify/storage';

import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import outputs from "../../amplify_outputs.json";

// AmplifyのStorage機能を使用
import { list } from 'aws-amplify/storage';
import { StorageImage } from '@aws-amplify/ui-react-storage';

// Cognito認証情報の取得
import { fetchAuthSession } from 'aws-amplify/auth';

import { v4 as uuidv4 } from 'uuid';

import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
// import { Product } from 'aws-cdk-lib/aws-servicecatalog';
const client = generateClient<Schema>();

const awsRegion = outputs.auth.aws_region;
const functionName = outputs.custom.makeslide_pipeFunctionName;


// interface Product {
//   id:string;
//   s3ImageUri:string;
//   name:string;
//   description:string;
//   partIds:string[];
// }

interface Part {
  id:string;
  s3ImageUri:string;
  name:string;
  description:string;
}

export const castProductAWSToInterface = (data: any[]) => {
  return data.map((item) => {
      return {
        id: item.id ?? '',
        s3ImageUri: item.s3ImageUri ?? '',
        name: item.name ?? '',
        description: item.description ?? '',
        partIds: item.partIds ?? '',
      };
  });
};

export const castPartAWSToInterface = (data: any[]) => {
  return data.map((item) => {
      return {
        id: item.id ?? '',
        s3ImageUri: item.s3ImageUri ?? '',
        name: item.name ?? '',
        description: item.description ?? '',
      };
  });
};

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

  // const [productData,setProductData] = useState<Product[]>([]);
  // const [partData,setPartData] = useState<Part[]>([]);

  // =========================
  // (1) 初期ロード時に S3 の files を取得
  // =========================
  const createRandomDemo = async () => {
    console.log("creating random data...")
    // データストア（仮の in-memory 配列）
    // 10個の Part を作成し、Amplify Data に登録
    async function createParts(): Promise<Part[]> {
      const parts: Part[] = [];
      for (let i = 0; i < 10; i++) {
        const id_uri = await uploadImageToS3("parts");


        const newPart = {
          id: id_uri[0],
          s3ImageUri: id_uri[1],
          name: `part_${id_uri[0]}`,
          description: `This is a randomly generated part.`,
        };

        const { errors, data } = await client.models.Part.create(newPart);
        if (errors) {
          console.error("Error creating Part:", errors);
        } else {
          console.log("datasotre created for part:", data);

          parts.push(data as Part);
        }
      }
      return parts;
    }

    async function createProducts(parts: Part[]): Promise<void> {
      for (let i = 0; i < 3; i++) {
        const selectedPartIds = parts
          .sort(() => 0.5 - Math.random()) // ランダムにシャッフル
          .slice(0, Math.floor(Math.random() * 2) + 3) // 3～4個の Part を選択
          .map(part => part.id);
        
        const id_uri = await uploadImageToS3("products");

        const newProduct = {
          id: id_uri[0],
          s3ImageUri: `products/product_${id_uri[1]}.jpg`,
          name: `product_${id_uri[0]}`,
          description: `This is a randomly generated product.`,
          partIds: selectedPartIds,
        };
    
        const { errors, data } = await client.models.Product.create(newProduct);
        if (errors) {
          console.error("Error creating Product:", errors);
        }else{
          console.log("success in creating product: ", data)
        }
      }
    }


    // **React環境での幾何学的な画像の生成**
  async function generateImage(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const width = 200;
      const height = 200;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context is not available"));
        return;
      }

      // 背景色をランダムに設定
      ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 80%)`;
      ctx.fillRect(0, 0, width, height);

      // ランダムな線を描画
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.strokeStyle = `hsl(${Math.random() * 360}, 100%, 50%)`;
        ctx.lineWidth = Math.random() * 5;
        ctx.stroke();
      }

      // Blob に変換して解決
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Blob conversion failed"));
        }
      }, "image/png");
    });
  }
    // S3 に画像をアップロードし、URL を取得する関数
    async function uploadImageToS3(prosorparts:string): Promise<(string[])> {
      const imageBlob = await generateImage();
      const id = uuidv4()
      const uri = `${prosorparts}/${id}.png`;

      const res = await uploadData({
        path: uri,
        data: imageBlob,
      }).result;
      console.log("success in uploading image to s3: ",res)

      return [id,uri];
    }
    

    const parts = await createParts();
    await createProducts(parts)
  }

  useEffect(() => {
    // const loadData = async () => {
    //   try {
        
    //           // Amplify Data API から一覧取得
    //     const { data: productRes, errors: productErr } = await client.models.Product.list();
    //     const { data: partRes, errors: partErr } = await client.models.Part.list();

    //     if (productErr || partErr) {
    //       console.error(productErr ?? partErr);
    //       // toast などで通知してもOK
    //       return;
    //     }
    //     // null→非null 変換
    //     const products = castProductAWSToInterface(productRes)
    //     const parts = castPartAWSToInterface(partRes)
    //     console.log("orgs:",products)
    //     setProductData(products || []);
    //     setPartData(parts || []);
    //   } catch (err) {
    //     console.error(err);
    //   }
    // };


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
      <Button colorScheme="blue" mt={6} onClick={createRandomDemo}>
        Demo data の作成
      </Button>


    </Box>
  );
};

export default ProductSlideCreation;