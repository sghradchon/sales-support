import { defineFunction } from "@aws-amplify/backend";
    
export const makeslide_pipe = defineFunction({
  name: "makeslide_pipe",
  entry: "./handler.ts"
});