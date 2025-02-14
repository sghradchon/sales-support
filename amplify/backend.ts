import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { makeslide_pipe } from './function/makeslide_pipe/resource';
const backend = defineBackend({
  auth,
  data,
  storage,
  makeslide_pipe
});

const authenticatedUserIamRole = backend.auth.resources.authenticatedUserIamRole;
backend.makeslide_pipe.resources.lambda.grantInvoke(authenticatedUserIamRole);

backend.addOutput({
   custom: {
      makeslide_pipeFunctionName: backend.makeslide_pipe.resources.lambda.functionName,
     },
 });