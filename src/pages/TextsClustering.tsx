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
  Input,
  Textarea
} from "@chakra-ui/react";
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import outputs from "../../amplify_outputs.json";
import { fetchAuthSession } from 'aws-amplify/auth';
import { ClustersMap,ClustersResponse } from "./TypesAndUtilsForClustering";
const awsRegion = outputs.auth.aws_region;
const functionName = outputs.custom.texts_clustering_pipeFunctionName;
// import { v4 as uuidv4 } from 'uuid';

const textsClusteringBucket = outputs.storage.buckets[1].bucket_name
const TEXTS_PREFIX = "texts/";

///下記はaws amplify gen2 の storageへのアクセスの凡例
import { downloadData ,list } from 'aws-amplify/storage';
//const downloadResult = await downloadData({ path: s3path }).result;
//const res = await uploadData({
      //   path: s3uri,
      //   data: imageBlob,
      // }).result;

// リスト取得後のアイテム構造
interface S3Item {
  path: string;
  eTag?: string;
  lastModified?: Date;
  size?: number;
}

// clustersをUnicodeエスケープから変換する関数
function decodeClustersMap(clusters: ClustersMap): ClustersMap {
    const decoded: ClustersMap = {};
    for (const clusterId in clusters) {
      const { texts, summary } = clusters[clusterId];
  
      // texts配列をUnicodeエスケープからデコード
      const decodedTexts = texts.map(txt => JSON.parse(`"${txt}"`));
  
      // summaryも同様
      const decodedSummary = JSON.parse(`"${summary}"`);
  
      decoded[clusterId] = {
        texts: decodedTexts,
        summary: decodedSummary
      };
    }
    return decoded;
  }



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

  const TextsClustering: React.FC = () => {
    const toast = useToast();
    // S3ファイル一覧
    const [s3Items, setS3Items] = useState<S3Item[]>([]);
    // ファイルから読み込んだテキスト配列
    const [fileTexts, setFileTexts] = useState<string[]>([]);
    // テキストエリアから入力されたテキスト配列
    const [manualTexts, setManualTexts] = useState<string[]>([]);
  
    // クラスタリング結果
    const [clusters, setClusters] = useState<ClustersMap>({});
    const [loading, setLoading] = useState(false);
  
    // ------------------ (1) JSONファイルアップロード ------------------
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
  
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        // ここで JSON or JSONL をパースして string[] にする
  
        try {
          // もし純粋に { "texts": ["...","..."] } のようなJSONなら
          const obj = JSON.parse(text);
          if (Array.isArray(obj)) {
            // 単純に ["text1","text2"] という配列だった場合
            setFileTexts(obj);
            toast({ title: "ファイルを配列として読み込みました", status: "success" });
          } else if (Array.isArray(obj.texts)) {
            setFileTexts(obj.texts);
            toast({ title: "ファイルの texts フィールドを読み込みました", status: "success" });
          } else {
            // JSON Linesの場合 (1行1オブジェクト)
            // ex: { "text": "xxx" }
            const lines = text.split("\n").map((ln) => ln.trim()).filter(Boolean);
            const arr: string[] = [];
            for (const ln of lines) {
              try {
                const lineObj = JSON.parse(ln);
                if (typeof lineObj.text === "string") {
                  arr.push(lineObj.text);
                }
              } catch {
                // 行がjsonじゃないなどの場合
                arr.push(ln);
              }
            }
            if (arr.length > 0) {
              setFileTexts(arr);
              toast({ title: "JSON Linesを行ごとに解析しました", status: "info" });
            } else {
              toast({ title: "ファイル形式が不明です", status: "warning" });
            }
          }
        } catch (err) {
          // JSON.parse失敗
          toast({
            title: "ファイルのパースに失敗しました",
            description: String(err),
            status: "error",
            duration: 5000,
          });
        }
      };
      reader.readAsText(file);
    };
  
    // ------------------ (2) テキストエリア入力 ------------------
    const [textareaValue, setTextareaValue] = useState("");
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTextareaValue(e.target.value);
    };
    // 改行ごとに分割して配列化
    const parseManualInput = () => {
      const lines = textareaValue.split("\n").map((ln) => ln.trim()).filter(Boolean);
      setManualTexts(lines);
      toast({
        title: "直打ちテキストを配列化しました",
        description: `${lines.length} 件の行を取得`,
        status: "success",
      });
    };

    //------------(2.5) S3からjson file 選択---------------
      // ----------- (2.5) S3一覧を取得して表示 -----------
  const listS3Textsfiles = async () => {
    try {
      setLoading(true);
      const result = await list({
        path: TEXTS_PREFIX,
        options: { bucket: textsClusteringBucket }
      });
      const items = (result.items || []) as S3Item[];
      setS3Items(items);
      toast({
        title: "S3ファイル一覧取得成功",
        description: `texts/下に ${items.length}件あり`,
        status: "success",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "ファイル一覧取得失敗",
        description: err.message,
        status: "error",
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };


    // ----------- (2.6) S3ファイルを選択してダウンロード -----------
    const handleS3FileSelect = async (filePath: string) => {
      try {
        setLoading(true);
        setFileTexts([]);
        setManualTexts([]);
        setClusters({});
  
        const downloadResult = await downloadData({
          path: filePath,
          options: { bucket: textsClusteringBucket }
        }).result;
        const rawText = await downloadResult.body.json();
        const obj = JSON.parse(rawText);
  
        let arr: string[] = [];
        if (Array.isArray(obj)) {
          arr = obj;
        } else if (Array.isArray(obj.texts)) {
          arr = obj.texts;
        }
        setFileTexts(arr);
        toast({
          title: "S3ファイルを読み込みました",
          description: filePath,
          status: "success"
        });
      } catch (err: any) {
        console.error(err);
        toast({
          title: "ダウンロード失敗",
          description: err.message,
          status: "error",
          duration: 4000
        });
      } finally {
        setLoading(false);
      }
    };
  
  
    // ------------------ (3) クラスタリング リクエスト ------------------
    const handleClusterRequest = async () => {
      setLoading(true);
      try {
        // fileTexts と manualTexts を結合する（用途に応じてどちらか一方でもOK）
        const merged = [...fileTexts, ...manualTexts];
        if (merged.length === 0) {
          toast({ title: "テキストがありません", status: "warning" });
          return;
        }
  
        const resultRaw = await trigger_lambda(merged);

        const resultObj = (typeof resultRaw === 'string')
            ? JSON.parse(resultRaw)
            : resultRaw;

        // 3. 型アサート
        const typedResult = resultObj as ClustersResponse;

        // 4. 必要なら decode
        const decodedClusters = decodeClustersMap(typedResult.clusters);


        if (decodedClusters) {
            
          setClusters(decodedClusters);
          toast({
            title: "クラスタリング成功",
            description: `クラスタ数: ${Object.keys(decodedClusters).length}`,
            status: "success",
          });
        } else {
          toast({
            title: "クラスタ情報がありません",
            description: "hoge",
            status: "info",
          });
        }
      } catch (err: any) {
        console.error(err);
        toast({
          title: "クラスタリングエラー",
          description: err.message,
          status: "error",
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <Box p={4}>
        <Heading size="lg" mb={4}>テキストクラスタリング</Heading>
  
        {/* (1) ファイルアップロード */}
        <Box mb={6}>
          <Heading size="md">1. JSON/JSONL ファイルアップロード</Heading>
          <Input
            type="file"
            accept=".json,.jsonl"
            onChange={handleFileUpload}
            mt={2}
          />
          <Text fontSize="sm" color="gray.600" mt={1}>
            ファイルから読み込んだ行数: {fileTexts.length}
          </Text>
        </Box>
  
        {/* (2) 直打ち入力 */}
        <Box mb={6}>
          <Heading size="md">2. 直打ち入力 (改行区切り)</Heading>
          <Textarea
            placeholder="改行ごとに文を並べてください"
            value={textareaValue}
            onChange={handleTextareaChange}
            rows={5}
            mt={2}
          />
          <Button colorScheme="teal" size="sm" mt={2} onClick={parseManualInput}>
            直打ちテキストを配列化
          </Button>
          <Text fontSize="sm" color="gray.600" mt={1}>
            手動入力で確定した行数: {manualTexts.length}
          </Text>
        </Box>
              {/* 2.5 S3 texts/ 下のファイル一覧を取得 & 選択 */}
      <Box mb={6} border="1px solid #ddd" p={3} borderRadius="md">
        <Heading size="md" mb={2}>S3の texts/ ファイル一覧</Heading>
        <Button colorScheme="blue" size="sm" onClick={listS3Textsfiles} isDisabled={loading}>
          {loading ? <Spinner size="sm" /> : "一覧を取得"}
        </Button>
        {s3Items.length > 0 && (
          <Box mt={3}>
            {s3Items.map(item => (
              <Box key={item.path} mb={1}>
                <Button variant="link" onClick={() => handleS3FileSelect(item.path)}>
                  {item.path} ({item.size} bytes)
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>
  
        {/* (3) クラスタリング実行 */}
        <Button
          colorScheme="blue"
          onClick={handleClusterRequest}
          isDisabled={loading}
        >
          {loading ? <Spinner size="sm" /> : "クラスタリング開始"}
        </Button>
  
        <Box mt={6}>
            <Heading size="md" mb={2}>クラスタ結果</Heading>
            {
                !clusters ? (
                <Text>まだ結果がありません。</Text>
                ) : Object.keys(clusters).length === 0 ? (
                <Text>クラスタが空です。</Text>
                ) : (
                <Accordion allowMultiple>
                    {Object.entries(clusters).map(([clusterId, data]) => {
                    // clusterId === '-1' の場合と、それ以外で分岐
                    if (clusterId === '-1') {
                        return (
                        <AccordionItem
                            key={clusterId}
                            border="1px solid #ccc"
                            borderRadius="md"
                            my={2}
                        >
                            <h2>
                            <AccordionButton>
                                <Box flex="1" textAlign="left">
                                <Text fontWeight="bold" fontSize="lg" color="red.600">
                                    クラスタ {clusterId} （飛び値）
                                </Text>
                                </Box>
                                <AccordionIcon />
                            </AccordionButton>
                            </h2>
                            <AccordionPanel pb={4}>
                            <Box mb={2}>
                                <Text fontSize="md" fontWeight="semibold" mb={2} color="red.600">
                                このクラスタは飛び値として分類されました。要約はありません。
                                </Text>
                            </Box>
                            <Box mt={2}>
                                <Text fontSize="md" fontWeight="semibold" mb={1}>
                                元テキスト
                                </Text>
                                {data.texts.map((txt, idx) => (
                                <Box
                                    key={idx}
                                    mb={2}
                                    p={2}
                                    bg="white"
                                    borderRadius="md"
                                    border="1px solid #eee"
                                >
                                    <Text fontSize="sm">{txt}</Text>
                                </Box>
                                ))}
                            </Box>
                            </AccordionPanel>
                        </AccordionItem>
                        );
                    } else {
                        // 通常のクラスタ表示
                        return (
                        <AccordionItem
                            key={clusterId}
                            border="1px solid #ccc"
                            borderRadius="md"
                            my={2}
                        >
                            <h2>
                            <AccordionButton>
                                <Box flex="1" textAlign="left">
                                <Text fontWeight="bold" fontSize="lg">
                                    クラスタ {clusterId}
                                </Text>
                                </Box>
                                <AccordionIcon />
                            </AccordionButton>
                            </h2>
                            <AccordionPanel pb={4}>
                            {/* 要約を上に表示 */}
                            <Box mb={4}>
                                <Text fontSize="md" fontWeight="semibold" mb={1}>
                                要約
                                </Text>
                                <Box bg="gray.50" p={2} borderRadius="md">
                                <Text fontSize="sm">{data.summary}</Text>
                                </Box>
                            </Box>
                            
                            {/* 元テキストを下に表示 */}
                            <Box mt={2}>
                                <Text fontSize="md" fontWeight="semibold" mb={1}>
                                元テキスト
                                </Text>
                                {data.texts.map((txt, idx) => (
                                <Box
                                    key={idx}
                                    mb={2}
                                    p={2}
                                    bg="white"
                                    borderRadius="md"
                                    border="1px solid #eee"
                                >
                                    <Text fontSize="sm">{txt}</Text>
                                </Box>
                                ))}
                            </Box>
                            </AccordionPanel>
                        </AccordionItem>
                        );
                    }
                    })}
                </Accordion>
                )
            }
            </Box>
      </Box>
    );
  };
  
  export default TextsClustering;