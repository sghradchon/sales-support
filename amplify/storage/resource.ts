import { defineStorage,defineFunction } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'products',
  access: (allow) => ({
    'products/*': [
      allow.authenticated.to(['read','write','delete']),
      allow.guest.to(['read','write']),
    //   allow.entity('identity').to(['read', 'write', 'delete']) 
    ],
    'parts/*': [
      allow.authenticated.to(['read','write','delete']),
      allow.guest.to(['read', 'write']),
    ],
    'secret/*':[]
  })
});