import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Organization: a.model({
    id:a.id(),
    organizationId: a.string(),
    organizationName: a.string(),
    upperLevelOrgId: a.string(),
    siblingLevelOrgOrder: a.integer(),
    memo: a.string(),

  }).authorization(allow => [allow.publicApiKey()]),

  Contact: a.model({
    id:a.id(),
    contactId: a.string(),
    lastName: a.string(),
    firstName: a.string(),
    organizationId: a.string(),
    title: a.string(),
    contactLevel: a.integer(),
    contactDescription: a.string()
  }).authorization(allow => [allow.publicApiKey()])
});

// Used for code completion / highlighting when making requests from frontend
export type Schema = ClientSchema<typeof schema>;

// defines the data resource to be deployed
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 90 }
  }
});
