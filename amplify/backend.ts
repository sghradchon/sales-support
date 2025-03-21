import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { makeslide_pipe } from './function/makeslide_pipe/resource';
import { texts_clustering_pipe } from './function/texts_clustering_pipe/resource';
const backend = defineBackend({
  auth,
  data, 
  storage,
  makeslide_pipe,
  texts_clustering_pipe
});

const authenticatedUserIamRole = backend.auth.resources.authenticatedUserIamRole;
const unauthenticatedUserIamRole = backend.auth.resources.unauthenticatedUserIamRole;

backend.makeslide_pipe.resources.lambda.grantInvoke(authenticatedUserIamRole);
backend.makeslide_pipe.resources.lambda.grantInvoke(unauthenticatedUserIamRole);

backend.texts_clustering_pipe.resources.lambda.grantInvoke(authenticatedUserIamRole);
backend.texts_clustering_pipe.resources.lambda.grantInvoke(unauthenticatedUserIamRole);


backend.addOutput({
   custom: {
      makeslide_pipeFunctionName: backend.makeslide_pipe.resources.lambda.functionName,
      texts_clustering_pipeFunctionName:backend.texts_clustering_pipe.resources.lambda.functionName,
     },
 });

// node.js lambdaを呼び出す権限grant invokeはここで与える
// python lambdaを呼び出す権限はaws consoleで与える
// 
// 
// 
