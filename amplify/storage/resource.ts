import { defineStorage,defineFunction } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'products',
  isDefault: true, // identify your default storage bucket (required)
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

export const textsClusteringStorage = defineStorage({
  name: 'textsClustering',
  access: (allow) => ({
    'texts/*': [
      allow.authenticated.to(['read','write','delete']),
      allow.guest.to(['read','write']),
    //   allow.entity('identity').to(['read', 'write', 'delete']) 
    ],
    'clusters/*': [
      allow.authenticated.to(['read','write','delete']),
      allow.guest.to(['read', 'write']),
    ],
    'secret/*':[]
  })
});


