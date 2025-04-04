import { defineFunction } from "@aws-amplify/backend";
    
export const texts_clustering_s3_trigger_pipe = defineFunction({
  name: "texts_clustering_s3_trigger_pipe",
  entry: "./handler.ts"
  
});