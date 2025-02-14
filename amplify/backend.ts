import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { makeslide_pipe } from './function/makeslide_pipe/resource';
defineBackend({
  auth,
  data,
  storage,
  makeslide_pipe
});
