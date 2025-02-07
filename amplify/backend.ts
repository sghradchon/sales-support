import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { makeslideFunctionHandler } from './function/makeslide/resource';

defineBackend({
  auth,
  data,
  makeslideFunctionHandler
});
