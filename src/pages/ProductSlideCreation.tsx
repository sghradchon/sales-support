import React, { useState } from 'react';
import { Button, Checkbox, Box, VStack, Text } from '@chakra-ui/react';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import outputs from "../../amplify_outputs.json";
import { fetchAuthSession } from 'aws-amplify/auth';

const awsRegion = outputs.auth.aws_region;
const functionName = outputs.custom.lambda_gen2FunctionName;


const lambdaClient = new LambdaClient({
  region: 'ap-northeast-1', // 適宜
  // 資格情報(Credentials)はAmplifyが自動的に注入するか、必要に応じて設定
});

const ProductSlideCreation: React.FC = () => {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const products = [
    { productId: 'prod1', name: '製品A' },
    { productId: 'prod2', name: '製品B' },
    { productId: 'prod3', name: '製品C' },
  ];

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setSelectedProductIds((prev) =>
      checked ? [...prev, id] : prev.filter((p) => p !== id)
    );
  };


  const trigger_lambda = async (productIds:[string]) => {
    const { credentials } = await fetchAuthSession();
    const body = {
      productIds:productIds
    };
    console.log("body: ",body)

    const lambda = new LambdaClient({ credentials: credentials, region: awsRegion });
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({
        body: body,
      }),
    });

    const response = await lambda.send(command);
    if (response.Payload) {
      const payload = JSON.parse(new TextDecoder().decode(response.Payload));
      return JSON.parse(payload);
    } else {
      return undefined;
    }
  };

  const createSlides = async () => {
    try {
      // Lambda呼び出し用のペイロード作成
      const payload = {
        productIds: selectedProductIds,
      };

      // LambdaをInvoke
      const command = new InvokeCommand({
        FunctionName: 'your-lambda-function-name', // デプロイしたLambdaの名称/ARN
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
      });

      const response = await lambdaClient.send(command);

      if (response.Payload) {
        const dec = new TextDecoder('utf-8');
        const jsonStr = dec.decode(response.Payload);
        const data = JSON.parse(jsonStr);
        
        if (data.slideUrl) {
          // スライドURLを新規タブで開く
          window.open(data.slideUrl, '_blank');
        } else if (data.error) {
          alert(`エラー: ${data.error}`);
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

  return (
    <Box p={6}>
      <Text fontSize="2xl" mb={4}>製品スライド作成</Text>
      <VStack align="start">
        {products.map((p) => (
          <Checkbox 
            key={p.productId}
            onChange={(e) => handleCheckboxChange(p.productId, e.target.checked)}
          >
            {p.name}
          </Checkbox>
        ))}
      </VStack>
      <Button colorScheme="blue" mt={6} onClick={createSlides}>
        スライドを作成
      </Button>
    </Box>
  );
};

export default ProductSlideCreation;