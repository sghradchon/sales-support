import { defineFunction } from "@aws-amplify/backend";
    
export const texts_clustering_pipe = defineFunction({
  name: "texts_clustering_pipe",
  entry: "./handler.ts"
  
});