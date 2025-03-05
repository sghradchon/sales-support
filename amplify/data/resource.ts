import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Organization: a.model({
    id: a.id(),
    organizationName: a.string(),
    upperLevelOrgId: a.string(),
    siblingLevelOrgOrder: a.integer(),
    memo: a.string(),

  }).authorization(allow => [allow.publicApiKey()]),

  Contact: a.model({
    id: a.id(),
    lastName: a.string(),
    firstName: a.string(),
    belongingOrgId: a.string(),
    title: a.string(),
    contactLevel: a.integer(),
    contactDescription: a.string(),
    keyPerson:a.boolean(),
  }).authorization(allow => [allow.publicApiKey()]),

  Product:a.model({
    id:a.id(),
    s3ImageUri:a.string(),
    name:a.string(),
    description:a.string(),
    partIds:a.string().array()
  }).authorization(allow => [allow.publicApiKey()]),

  Opportunity: a.model({
    id: a.id(), // 一意のID
    contactId: a.string(), // Contactの関連ID
    CustomerName: a.string(),
    ProductName: a.string(),
    OpportunityName: a.string(),
    Distributor: a.string(),
    Application: a.string(),
    Territory: a.string(),
    TargetPrice: a.float(),
    CustomerBudget: a.float(),
    CompetitorPrice: a.float(),
    CurrentStatus: a.string(),
  }).authorization(allow => [allow.publicApiKey()]),

  Activity : a.model({
    id: a.id(), // 一意のID
    contactId: a.string(), // Contactの関連ID
    activity: a.string(),
  }).authorization(allow => [allow.publicApiKey()]),

    // 部品テーブル
  Part: a.model({
    id: a.id(),
    s3ImageUri:a.string(),
    name: a.string(),
    description: a.string(),
  }).authorization(allow => [allow.publicApiKey()]),

  // 多対多の中間テーブル (製品ID, 部品ID)
  // ProductPart: a.model({
  //   id: a.id(),          // 一意なID
  //   productId: a.string(), // 紐づく Product のID
  //   partId: a.string(),    // 紐づく Part のID
  // }).authorization(allow => [
  //   allow.publicApiKey()
  // ]),


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
