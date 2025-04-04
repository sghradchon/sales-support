import type { Handler,S3Event } from 'aws-lambda';
import AWS from 'aws-sdk';


const lambda = new AWS.Lambda();

export const handler: Handler<S3Event> = async (event, context) => {
    console.log("S3 Trigger Event:", JSON.stringify(event, null, 2));
  
    // S3Eventは複数オブジェクトを一度に受け取る可能性がある
    for (const record of event.Records) {
      const bucketName = record.s3.bucket.name;
      // keyはURLエンコードされているのでdecode
      const key = decodeURIComponent(record.s3.object.key);
  
      console.log("Uploading file name =>", key);
  
      // texts_clustering_gen1 に渡すPayloadを作成
      // ここでは { body: "{\"s3Key\":\"...\"}" } としている
      const eventPayload = {
        body: JSON.stringify({
          s3Bucket: bucketName,   // ここにバケット名を載せて一緒に渡す
          s3Key: key
        })
      };
  
      // invokeパラメータ
      const params = {
        FunctionName: 'texts_clustering_s3_trigger_gen1', // 別のLambda名
        Payload: JSON.stringify(eventPayload)
      };
  
      try {
        // 別Lambdaを同期呼び出し
        const result = await lambda.invoke(params).promise();
        console.log("Invoke result =>", result);
  
        // result.Payload はstringかundefined
        if (result.Payload) {
          const payloadParsed = JSON.parse(result.Payload as string);
          console.log("Parsed payload =>", payloadParsed);
        }
        // 必要に応じて result.Payload を活用
      } catch (error) {
        console.error("Error invoking texts_clustering_gen1:", error);
      }
    }
  
    return { statusCode: 200, body: "OK" };
  };