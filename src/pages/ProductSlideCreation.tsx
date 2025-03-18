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

// import outputs from "../../amplify_outputs.json";

// AmplifyのStorage機能を使用
import { list,downloadData,uploadData } from 'aws-amplify/storage';
import { StorageImage } from '@aws-amplify/ui-react-storage';

// Cognito認証情報の取得
// import { fetchAuthSession } from 'aws-amplify/auth';

import { v4 as uuidv4 } from 'uuid';

import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

import PptxGenJS from "pptxgenjs";

import { Product,Part,castPartAWSToInterface,castProductAWSToInterface } from './TypesAndUtilsForSlide';

// import { Product } from 'aws-cdk-lib/aws-servicecatalog';
const client = generateClient<Schema>();

// const awsRegion = outputs.auth.aws_region;
// const functionName = outputs.custom.makeslide_pipeFunctionName;



// ========================
// (3) メインコンポーネント
// ========================
const ProductSlideCreation: React.FC = () => {
  // DataStore から取得した全 Product, Part
  const [products, setProducts] = useState<Product[]>([]);
  const [parts, setParts] = useState<Part[]>([]);

  // Part を高速参照したいので、[partId -> Part] のマップを作る
  const [partMap, setPartMap] = useState<Record<string, Part>>({});

  // チェックされた Product ID 一覧
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // 生成した PPTX ファイル用の URL (Blob を作ってここに格納する想定)
  const [slideUrl, setSlideUrl] = useState<string>("");

  // =========================
  // (4) 初回ロード時に Products / Parts を取得
  // =========================
  useEffect(() => {
    const fetchDataStore = async () => {
      try {
        // 全Product
        const { data: productData, errors: prodErr } = await client.models.Product.list({});
        if (prodErr) {
          console.error("Error fetching Products:", prodErr);
        }
        // 全Part
        const { data: partData, errors: partErr } = await client.models.Part.list({});
        if (partErr) {
          console.error("Error fetching Parts:", partErr);
        }

        const allProducts = (productData ?? []) as Product[];
        console.log("products",products)
        const allParts = (partData ?? []) as Part[];

        // Part のマップを作る
        const pMap: Record<string, Part> = {};
        for (const p of allParts) {
          pMap[p.id] = p;
        }

        setProducts(allProducts);
        setParts(allParts);
        setPartMap(pMap);
      } catch (error) {
        console.error("Unexpected error fetching DataStore:", error);
      }
    };

    fetchDataStore();
  }, []);

  // =========================
  // (5) チェックボックス操作
  // =========================
  const handleCheckboxChange = (productId: string, checked: boolean) => {
    setSelectedProductIds((prev) => {
      if (checked) {
        return [...prev, productId];
      } else {
        return prev.filter((id) => id !== productId);
      }
    });
  };

  // =========================
  // (6) PPTX スライド生成
  // =========================

  /**
   * S3上の画像を base64 DataURL に変換
   */
  const getBase64FromS3 = async (s3path: string): Promise<string> => {
    try {
      // Amplify Storage でダウンロード
      const downloadResult = await downloadData({ path: s3path }).result;
      const blob: Blob = await downloadResult.body.blob();

      // Blob -> base64(DataURL) に変換
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error getBase64FromS3:", error);
      throw error;
    }
  };

  /**
   * スライド作成
   *  - 選択された Product を1つずつ新しいスライドに配置
   *  - 周囲に Part (product.partIds に紐づくもの) を円形配置
   */
  const createSlides = async () => {
  try {
    if (selectedProductIds.length === 0) {
      alert("スライドを作成したい製品にチェックを入れてください。");
      return;
    }

    const pptx = new PptxGenJS();

    for (const productId of selectedProductIds) {
      const product = products.find((p) => p.id === productId);
      if (!product) continue;

      const slide = pptx.addSlide();

      // ----------------------------
      // 1) 製品の画像をスライド中央に配置
      // ----------------------------
      // スライド全体のデフォルト: width=10in, height=5.63in
      // ここでは、(4, 1.5) に 2x2インチの画像として配置し、
      // "中心" をおおよそ (5, 2.5) とする
      const productX = 4.0;
      const productY = 1.5;
      const productW = 2.0;
      const productH = 2.0;

      // Product 画像をダウンロード => base64
      const productBase64 = await getBase64FromS3(product.s3ImageUri);

      slide.addText(`Product: ${product.name}`, {
        x: 0.5,
        y: 0.3,
        fontSize: 18,
        bold: true,
      });
      slide.addImage({
        data: productBase64,
        x: productX,
        y: productY,
        w: productW,
        h: productH,
      });

      // 製品画像の中心座標 (線を引くときに使う)
      const productCenterX = productX + productW / 2;
      const productCenterY = productY + productH / 2;

      // ----------------------------
      // 2) この Product が持つ Part を取得
      // ----------------------------
      const productParts: Part[] = [];
      for (const partId of product.partIds) {
        if (partMap[partId]) {
          productParts.push(partMap[partId]);
        }
      }

      // ----------------------------
      // 3) Part の配置座標を円形に計算
      // ----------------------------
      const radius = 2.5; // 中心からの半径 (inch)
      // Part を配置する円の中心を "productCenterX, productCenterY" にする
      // → Product の周囲に円を描くイメージ
      const circleCenterX = productCenterX;
      const circleCenterY = productCenterY;

      // Part 座標配列をあらかじめ計算
      const partPositions = productParts.map((_, idx) => {
        const angle = (2 * Math.PI * idx ) / productParts.length +Math.PI/6;
        // Part の"画像の中心"座標を円周上に計算
        const cx = circleCenterX + radius * Math.cos(angle);
        const cy = circleCenterY + radius * Math.sin(angle);

        // ただし後で画像を配置するときは、画像の左上座標が必要なので
        // w=1, h=1 (Part画像サイズ1x1) なら左上は (cx - 0.5, cy - 0.5)
        return { centerX: cx, centerY: cy,angle:angle};
      });

      // ----------------------------
      // 4) Product と Part を結ぶ線を描画 (Part画像の前に追加)
      // ----------------------------
      partPositions.forEach((pos) => {
        // Product 中心 => Part 中心 への線を引くために
        // (x1,y1)→(x2,y2) のバウンディングボックスと回転角度を求める
        const x1 = productCenterX;
        const y1 = productCenterY;
        const x2 = pos.centerX;
        const y2 = pos.centerY;

        // 左上基準 (minX, minY)
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        // 幅・高さ
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);

        var rotate = 0

        if ((x === x1 && y === y1) || (x === x2 && y === y2)) {
          rotate = 0
        } else {
          rotate = 180 / Math.PI * (Math.PI - 2* Math.atan(h/w))
        }
          // 回転角度 (atan2(Y差, X差) → degrees)
        const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        console.log("angleDeg",angleDeg)
        console.log("rotate",rotate)
        // 線を追加
        // shape: pptx.shapes.LINE (直線)
        slide.addShape(pptx.ShapeType.line, {
          x:x,
          y:y,
          w:w,
          h:h,
          line: { color: "888888", width: 1 },
          rotate: rotate,
        });
      });

      // ----------------------------
      // 5) Part 画像を配置 (線の上に重なる)
      // ----------------------------
      for (let i = 0; i < productParts.length; i++) {
        try {
          const part = productParts[i];
          const { centerX: cx, centerY: cy,angle:_ } = partPositions[i];

          // S3 から Part 画像をダウンロード
          const partBase64 = await getBase64FromS3(part.s3ImageUri);

          // Part画像サイズを 1x1インチ として
          const partW = 1.0;
          const partH = 1.0;
          const partX = cx - partW / 2; // 中心基準
          const partY = cy - partH / 2;

          // 画像追加
          slide.addImage({
            data: partBase64,
            x: partX,
            y: partY,
            w: partW,
            h: partH,
          });
        } catch (err) {
          console.error("Error adding part image:", err);
        }
      }
    }

    // PPTX を Blob として書き出し、Fileオブジェクトに変換
    const blob = await pptx.write({ outputType: "blob" });
    const pptxFile = new File([blob], "mySlides.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    // ダウンロード用URLを生成して新規タブで開く
    const url = URL.createObjectURL(pptxFile);
    window.open(url, "_blank");
    setSlideUrl(url);

  } catch (error) {
    console.error("Error creating PPTX slides:", error);
  }
};
  /**
   * (参考) ランダムなデモデータを作成する
   *   - S3 に画像アップロード -> Product/Part 作成
   *   - 例示用に残しています (必要なければ削除)
   */
  const createRandomDemo = async () => {
    console.log("creating random data...");

    // 幾何学的なランダム画像を生成 (React 環境で canvas.toBlob)
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

        // Blob に変換
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Blob conversion failed"));
          }
        }, "image/png");
      });
    }

    // S3 に画像をアップロード
    async function uploadImageToS3(folderName: string): Promise<[string, string]> {
      const imageBlob = await generateImage();
      const id = uuidv4();
      const uri = `${folderName}/${id}.png`;

      const res = await uploadData({
        path: uri,
        data: imageBlob,
      }).result;
      console.log("Uploaded image to S3: ", res);

      // 戻り値: [生成したID, S3 Key]
      return [id, uri];
    }

    // 1) Part を10個ランダムに生成
    async function createParts(): Promise<Part[]> {
      const partsArray: Part[] = [];
      for (let i = 0; i < 10; i++) {
        const [id, s3key] = await uploadImageToS3("parts");
        const newPart = {
          id: id,
          s3ImageUri: s3key,
          name: `part_${id}`,
          description: `Randomly generated part`,
        };
        const { data, errors } = await client.models.Part.create(newPart);
        if (errors) {
          console.error("Error creating Part:", errors);
        } else {
          console.log("Created Part in DataStore:", data);
          partsArray.push(data as Part);
        }
      }
      return partsArray;
    }

    // 2) Product を3個ランダムに生成, 各Productにつき3~4個の Part を割り当て
    async function createProducts(allParts: Part[]): Promise<void> {
      for (let i = 0; i < 3; i++) {
        // ランダムに3~4個の Part を選ぶ
        const shuffled = [...allParts].sort(() => 0.5 - Math.random());
        const selectedPartIds = shuffled.slice(0, Math.floor(Math.random() * 2) + 3).map(p => p.id);

        const [id, s3key] = await uploadImageToS3("products");
        const newProduct = {
          id: id,
          s3ImageUri: s3key,
          name: `product_${id}`,
          description: `Randomly generated product`,
          partIds: selectedPartIds,
        };
        const { data, errors } = await client.models.Product.create(newProduct);
        if (errors) {
          console.error("Error creating Product:", errors);
        } else {
          console.log("Created Product in DataStore:", data);
        }
      }
    }

    // 実行
    const parts = await createParts();
    await createProducts(parts);
    alert("Demo data の作成が完了しました。再度画面をリロードして確認してください。");
  };

  // =========================
  // (7) ダウンロードリンククリック
  // =========================
  const handleSlideUrlClick = () => {
    if (slideUrl) {
      window.open(slideUrl, "_blank");
    }
  };

  // =========================
  // (8) 画面描画
  // =========================
  return (
    <Box p={6}>
      <Text fontSize="2xl" mb={4}>製品スライド作成 (DataStore + S3 + PPTX)</Text>

      {slideUrl && (
        <Button colorScheme="blue" mt={6} onClick={handleSlideUrlClick}>
          スライドができました (ダウンロードリンク)
        </Button>
      )}

      <VStack align="start" spacing={4} mt={4}>
        {products.length === 0 ? (
          <Text>Loading products from DataStore...</Text>
        ) : (
          products.map((product) => (
            
            <HStack key={product.id} spacing={3} borderWidth="1px" p={2} borderRadius="md">
              <Checkbox
                onChange={(e) => handleCheckboxChange(product.id, e.target.checked)}
              >
                {product.s3ImageUri}
              </Checkbox>

              <StorageImage alt={product.name} path={product.s3ImageUri} />
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