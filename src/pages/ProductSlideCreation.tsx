import React, { useState } from 'react';
import { Button, Checkbox, Box, VStack, Text } from '@chakra-ui/react';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import outputs from "../../amplify_outputs.json";
import { fetchAuthSession } from 'aws-amplify/auth';

const awsRegion = outputs.auth.aws_region;
const functionName = outputs.custom.makeslide_pipeFunctionName;


const ProductSlideCreation: React.FC = () => {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const products = [
    { productId: 'pr1', name: '製品AAA' },
    { productId: 'pr2', name: '製品BBB' },
    { productId: 'pr3', name: '製品CCC' },
  ];

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setSelectedProductIds((prev) =>
      checked ? [...prev, id] : prev.filter((p) => p !== id)
    );
  };


  const trigger_lambda = async (productIds:string[]) => {
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
      console.log("payload",payload)
      return payload//JSON.parse(payload);
    } else {
      return undefined;
    }
  };

  const createSlides = async () => {
    try {

      const payload = await trigger_lambda(selectedProductIds)//lambdaClient.send(command);
      console.log("payload",payload)
      
      if (payload) {
        const message = payload.message;
        console.log("message:",message)
        if (message == "success"){
          const slideUrl = payload.slideUrl;
          console.log("slideUrl:",slideUrl)
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