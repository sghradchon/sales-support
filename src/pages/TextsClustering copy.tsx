import React, { useState } from "react";
import {
  Box,
  Button,
  Heading,
  Text,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import outputs from "../../amplify_outputs.json";
import { fetchAuthSession } from 'aws-amplify/auth';
const awsRegion = outputs.auth.aws_region;
const functionName = outputs.custom.texts_clustering_pipeFunctionName;

type ClustersResponse = {
    clusters: Record<string, string[]>; 
    // 例: { "0": ["文1","文2"], "1": [...], "-1": [...], ... }
};

// 返ってくるクラスタ情報を扱いやすいように型定義
type ClusterMap = Record<string, string[]>;

const TextsClustering: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<ClusterMap>({});
  const toast = useToast();

  const trigger_lambda = async (texts: string[]) => {
    // 認証情報・Regionなどの設定
    const { credentials } = await fetchAuthSession();
    const lambda = new LambdaClient({ credentials, region: awsRegion });
  
    // bodyに入れる
    const body = { "texts":texts };
    console.log("request body:", body);
  
    // InvokeCommand で Lambda を呼ぶ
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({ body }),
    });
  
    // Lambda実行
    const response = await lambda.send(command);
  
    if (response.Payload) {
      // PayloadはUint8Arrayなので、TextDecoderで文字列化
      const rawPayload = new TextDecoder().decode(response.Payload);
      console.log("rawPayload:", rawPayload);
  
      // Lambda側で多重にjson.dumpsしている場合は二重パースが必要
      // 1回目のパース
      const parsedPayload = JSON.parse(rawPayload);
  
      // もしさらに中にJSON文字列が入っていれば再パース
      // 例: parsedPayloadが {"statusCode":200,"body":"{\"clusters\":{...}}"} など
      if (typeof parsedPayload === "object" && parsedPayload.body) {
        // bodyが文字列として入っているなら再パース
        try {
          const reParsed = JSON.parse(parsedPayload.body);
          return reParsed; // { clusters: { "0": [...], ... } }
        } catch (err) {
          // bodyがただの文字列の可能性もある
          return parsedPayload;
        }
      }
  
      return parsedPayload;
    } else {
      return undefined;
    }
  };

    // 実行ボタンハンドラ
    const handleInvokeLambda = async () => {
        setLoading(true);
        try {
          // 例: 送る配列 (本来はUIから取得する想定)
          const texts = ["id001", "id002", "id003"];
    
          const result:ClustersResponse = await trigger_lambda(texts);
    
          console.log("Lambda result:", result);
          /**
           * 期待する形式: 
           *  {
           *    clusters: {
           *       "0": ["文A","文B"], 
           *       "1": ["文C"], 
           *       ...
           *    }
           *  }
           */
          if (result && result.clusters) {
            setClusters(result.clusters);
            toast({
              title: "Lambda呼び出し成功",
              description: "クラスタ情報を取得しました",
              status: "success",
              duration: 3000,
            });
          } else {
            toast({
              title: "クラスタ情報がありません",
              description: JSON.stringify(result),
              status: "info",
              duration: 3000,
            });
          }
        } catch (error: any) {
          console.error("Error calling Lambda:", error);
          toast({
            title: "Lambda呼び出しエラー",
            description: error.message,
            status: "error",
            duration: 5000,
          });
        } finally {
          setLoading(false);
        }
      };
    
      return (
        <Box p={4}>
          <Heading size="lg" mb={4}>
            HDBSCAN クラスタリング結果 (Lambda呼び出し)
          </Heading>
    
          <Button colorScheme="teal" onClick={handleInvokeLambda} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Lambda実行"}
          </Button>
    
          {/* 結果表示 */}
          <Box mt={6}>
            {Object.keys(clusters).length === 0 ? (
              <Text>まだクラスタ結果がありません。</Text>
            ) : (
              <Accordion allowMultiple>
                {Object.entries(clusters).map(([clusterId, texts]) => (
                  <AccordionItem key={clusterId} border="1px solid #ccc" borderRadius="md" my={2}>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          クラスタ {clusterId}
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      {texts.map((txt, idx) => (
                        <Box key={idx} mb={2} p={2} bg="gray.50" borderRadius="md">
                          <Text fontSize="sm">{txt}</Text>
                        </Box>
                      ))}
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </Box>
        </Box>
      );
    };

export default TextsClustering;