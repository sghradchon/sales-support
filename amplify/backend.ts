import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage,textsClusteringStorage } from './storage/resource';
import { makeslide_pipe } from './function/makeslide_pipe/resource';
import { texts_clustering_pipe } from './function/texts_clustering_pipe/resource';
import { texts_clustering_s3_trigger_pipe } from './function/texts_clustering_s3_trigger_pipe/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

const backend = defineBackend({
  auth,
  data, 
  storage,
  textsClusteringStorage,
  makeslide_pipe,
  texts_clustering_pipe,
  texts_clustering_s3_trigger_pipe
});

const authenticatedUserIamRole = backend.auth.resources.authenticatedUserIamRole;
const unauthenticatedUserIamRole = backend.auth.resources.unauthenticatedUserIamRole;

backend.makeslide_pipe.resources.lambda.grantInvoke(authenticatedUserIamRole);
backend.makeslide_pipe.resources.lambda.grantInvoke(unauthenticatedUserIamRole);

backend.texts_clustering_pipe.resources.lambda.grantInvoke(authenticatedUserIamRole);
backend.texts_clustering_pipe.resources.lambda.grantInvoke(unauthenticatedUserIamRole);

backend.texts_clustering_s3_trigger_pipe.resources.lambda.grantInvoke(authenticatedUserIamRole);
backend.texts_clustering_s3_trigger_pipe.resources.lambda.grantInvoke(unauthenticatedUserIamRole);


backend.addOutput({
   custom: {
      makeslide_pipeFunctionName: backend.makeslide_pipe.resources.lambda.functionName,
      texts_clustering_pipeFunctionName:backend.texts_clustering_pipe.resources.lambda.functionName,
      texts_clustering_s3_trigger_pipeFunctionName:backend.texts_clustering_s3_trigger_pipe.resources.lambda.functionName,
     },
 });

backend.textsClusteringStorage.resources.bucket.addEventNotification(
	EventType.OBJECT_CREATED_PUT,
	new LambdaDestination(backend.texts_clustering_s3_trigger_pipe.resources.lambda),
	{
		prefix: 'texts/',
		suffix: '.json',
	}
);

// node.js lambdaを呼び出す権限grant invokeはここで与える
// python lambdaを呼び出す権限はaws consoleで与える
// 
// 
// 
