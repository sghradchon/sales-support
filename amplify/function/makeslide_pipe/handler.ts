import type { Handler } from 'aws-lambda';
import AWS from 'aws-sdk';


const lambda = new AWS.Lambda();

export const handler: Handler = async (event, context) => {
  console.log(":チェックマーク_緑:event", event);
  const eventPayload = {
    body: JSON.stringify({
      productIds: event.body.productIds
    })
  };
  const params = {
    FunctionName: 'makeslide_gen1',
    Payload: JSON.stringify(eventPayload)
  };

  try {
    // ifb_rag_lambda Lambda 関数を呼び出す
    const result = await lambda.invoke(params).promise();
    console.log(":チェックマーク_緑:result", result);
    // レスポンスのペイロードを解析
    const payload = JSON.parse(result.Payload as string);
    console.log(":チェックマーク_緑:payload", payload);
    // body のみを返す
    return payload.body;
  } catch (error) {
    console.error(":x:Error invoking makeslide_gen1:", error);
    return {
      statusCode: 500,
      body: JSON.stringify(error)
    };
  }
};