import React, { useState, useEffect } from 'react';
import {
  Button,
  Checkbox,
  Box,
  VStack,
  Text,
  HStack
} from '@chakra-ui/react';

import { createCanvas } from 'canvas'; // もし Node.js Canvas API を使うのであれば（ここではWeb canvasに置き換え可）

import { uploadData } from 'aws-amplify/storage';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

import outputs from "../../amplify_outputs.json";

// Amplify の Storage 機能 & Auth 機能 (認証情報取得)
import { list } from 'aws-amplify/storage'; // ※ 今回は使わなくなったが念のため
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { getUrl } from 'aws-amplify/storage';

import { fetchAuthSession } from 'aws-amplify/auth';

import { v4 as uuidv4 } from 'uuid';

// Amplify Data
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

//  Amplify Outputs
const awsRegion = outputs.auth.aws_region;
const functionName = outputs.custom.makeslide_pipeFunctionName;

// ---------------------------------------
// 型定義
// ---------------------------------------
interface Product {
  id: string;
  s3ImageUri: string;
  name: string;
  description: string;
  partIds: string[];
}

interface Part {
  id: string;
  s3ImageUri: string;
  name: string;
  description: string;
}

export const castProductAWSToInterface = (data: any[]) => {
  return data.map((item) => ({
    id: item.id ?? '',
    s3ImageUri: item.s3ImageUri ?? '',
    name: item.name ?? '',
    description: item.description ?? '',
    partIds: item.partIds ?? [],
  }));
};

export const castPartAWSToInterface = (data: any[]) => {
  return data.map((item) => ({
    id: item.id ?? '',
    s3ImageUri: item.s3ImageUri ?? '',
    name: item.name ?? '',
    description: item.description ?? '',
  }));
};

// ---------------------------------------
// メインコンポーネント
// ---------------------------------------
const ProductSlideCreation_copy: React.FC = () => {
  // Amplify Data から取得した製品一覧
  const [productData, setProductData] = useState<Product[]>([]);
  // Amplify Data から取得した部品一覧 (今回はUI表示には使わない)
  const [partData, setPartData] = useState<Part[]>([]);

  // 選択された Product のID一覧
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // 生成されたスライドのURL
  const [slideUrl, setSlideUrl] = useState<string>("");

  // =========================
  // (1) 初期ロード: Amplify Data から Product & Part 一覧を取得
  // =========================
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: productRes, errors: productErr } = await client.models.Product.list();
        const { data: partRes, errors: partErr } = await client.models.Part.list();

        if (productErr || partErr) {
          console.error(productErr ?? partErr);
          return;
        }
        // 整形してステートにセット
        const products = castProductAWSToInterface(productRes);
        const parts = castPartAWSToInterface(partRes);

        setProductData(products);
        setPartData(parts);
      } catch (err) {
        console.error(err);
      }
    };

    loadData();
  }, []);

  // =========================
  // チェックボックスを操作
  // =========================
  const handleCheckboxChange = (productId: string, checked: boolean) => {
    setSelectedProductIds((prev) =>
      checked ? [...prev, productId] : prev.filter((p) => p !== productId)
    );
  };

  // =========================
  // (2) Lambda呼び出し
  // =========================
  const trigger_lambda = async (productS3Uris: string[]) => {
    const { credentials } = await fetchAuthSession();

    // Lambdaに送信するpayload
    const body = {
      productS3Uris,
    };
    console.log("Sending to lambda body: ", body);

    const lambda = new LambdaClient({ credentials, region: awsRegion });
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({ body }),
    });

    const response = await lambda.send(command);
    if (response.Payload) {
      const rawPayload = new TextDecoder().decode(response.Payload);
      console.log("rawPayload:", rawPayload);

      // 場合によっては二重にJSON.parseが必要
      //  1回目: Invoke時の {body: "..."} 形式 → 2回目: その中身をパース
      const parsedFirst = JSON.parse(rawPayload);

      // AmplifyのLambda呼び出しで { "body":"{\"message\":...,\"slideUrl\":...}" } の形の場合がある
      let final;
      if (typeof parsedFirst.body === "string") {
        final = JSON.parse(parsedFirst.body);
      } else {
        // あるいはもう最終JSON
        final = parsedFirst;
      }
      return final;
    } else {
      return undefined;
    }
  };

  // =========================
  // (3) スライド作成ボタン
  // =========================
  const createSlides = async () => {
    try {
      // 選択された Product の s3ImageUri を取り出す
      const selectedProducts = productData.filter(p => selectedProductIds.includes(p.id));
      const productS3Uris = selectedProducts.map(p => p.s3ImageUri);

      const payload = await trigger_lambda(productS3Uris);
      console.log("payload", payload);

      if (payload) {
        const message = payload.message;
        if (message === "success") {
          const url = payload.slideUrl;
          setSlideUrl(url);
          window.open(url, '_blank');
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

  // =========================
  // (4) ランダムなデモデータ生成
  // =========================
  const createRandomDemo = async () => {
    console.log("Creating random data...");

    // (A) 部品を10個ほど作る
    async function createParts(): Promise<Part[]> {
      const newParts: Part[] = [];
      for (let i = 0; i < 10; i++) {
        // 画像をCanvasで生成しS3アップ
        const [id, uri] = await uploadImageToS3("parts");
        const newPart = {
          id: id,
          s3ImageUri: uri,
          name: `part_${id}`,
          description: `Randomly generated part`,
        };

        const { errors, data } = await client.models.Part.create(newPart);
        if (errors) {
          console.error("Error creating Part:", errors);
        } else {
          console.log("Created Part:", data);
          newParts.push(data as Part);
        }
      }
      return newParts;
    }

    // (B) ランダムに Parts を紐付けて、Product を3つほど作る
    async function createProducts(parts: Part[]): Promise<void> {
      for (let i = 0; i < 3; i++) {
        // 3～4個の部品をランダム選択
        const selectedPartIds = parts
          .sort(() => 0.5 - Math.random()) 
          .slice(0, Math.floor(Math.random() * 2) + 3)
          .map(p => p.id);

        const [id, uri] = await uploadImageToS3("products");

        const newProduct = {
          id,
          s3ImageUri: uri,
          name: `product_${id}`,
          description: `Randomly generated product`,
          partIds: selectedPartIds,
        };

        const { errors, data } = await client.models.Product.create(newProduct);
        if (errors) {
          console.error("Error creating Product:", errors);
        } else {
          console.log("Created Product:", data);
        }
      }
    }

    // (C) 画像を生成してS3にアップロード
    async function generateImageBlob(): Promise<Blob> {
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

        // 背景色
        ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 80%)`;
        ctx.fillRect(0, 0, width, height);

        // ランダムな線を数本描く
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * width, Math.random() * height);
          ctx.lineTo(Math.random() * width, Math.random() * height);
          ctx.strokeStyle = `hsl(${Math.random() * 360}, 100%, 50%)`;
          ctx.lineWidth = Math.random() * 5;
          ctx.stroke();
        }

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob failed"));
        }, "image/png");
      });
    }

    async function uploadImageToS3(folder: string): Promise<[string, string]> {
      const imageBlob = await generateImageBlob();
      const id = uuidv4();
      const uri = `${folder}/${id}.png`;

      const res = await uploadData({
        path: uri,
        data: imageBlob,
      }).result;
      console.log("Uploaded image to S3:", res);
      // return [生成したID, S3パス]
      return [id, uri];
    }

    // 実行
    const parts = await createParts();
    await createProducts(parts);
    alert("Demo data creation finished. Reload or re-fetch to see the new data.");
  };



  // =========================
  // (5) 画面表示
  // =========================
  interface ImageDisplayProps {
    s3Path: string; // S3上のパス ("products/xxxx.png" など)
    altText?: string; // 画像のalt属性用
  }
  
  const StorageImageWithSignedUrl: React.FC<ImageDisplayProps> = ({ s3Path, altText }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
  
    useEffect(() => {
      const fetchSignedUrl = async () => {
        try {
          const linkToStorageFile = await getUrl({ path: s3Path });
          console.log(`Signed URL for ${s3Path}: `, linkToStorageFile.url);
          setSignedUrl(linkToStorageFile.url.toString());
        } catch (error) {
          console.error(`Error fetching signed URL for ${s3Path}:`, error);
        }
      };
  
      fetchSignedUrl();
    }, [s3Path]);
  
    return (
      <Box>
        {signedUrl ? (
          <StorageImage path={s3Path}  alt={altText || "Image"} />
        ) : (
          <Text>Loading image...</Text>
        )}
      </Box>
    );
  };
  
  return (
    <Box p={6}>
      <Text fontSize="2xl" mb={4}>製品スライド作成</Text>

      {/* 生成されたスライドURLがあれば、ボタンを押すと新タブで開く */}
      {slideUrl && (
        <Button
          colorScheme="blue"
          onClick={() => window.open(slideUrl, "_blank")}
          mb={4}
        >
          作成したスライドを開く
        </Button>
      )}

      <VStack align="start" spacing={4}>
        {productData.length === 0 ? (
          <Text>Loading products from Data Store...</Text>
        ) : (
          productData.map((prod) => (
            <HStack key={prod.id} spacing={3}>
              <Checkbox
                isChecked={selectedProductIds.includes(prod.id)}
                onChange={(e) =>
                  handleCheckboxChange(prod.id, e.target.checked)
                }
              >
                {prod.name} ({prod.id})
              </Checkbox>

              {/* S3に保存されている画像を表示 (path = prod.s3ImageUri) */}
              {prod.s3ImageUri && (
                <Box boxSize="100px">
                  {/* <StorageImage
                    alt="product image"
                    path={prod.s3ImageUri}
                  /> */}
              <StorageImageWithSignedUrl s3Path={prod.s3ImageUri} />
              </Box>
              )}
            </HStack>
          ))
        )}
      </VStack>

      <Button colorScheme="blue" mt={6} onClick={createSlides}>
        スライドを作成
      </Button>

      <Button colorScheme="blue" mt={6} ml={4} onClick={createRandomDemo}>
        Demo data の作成
      </Button>
    </Box>
  );
};

export default ProductSlideCreation_copy;