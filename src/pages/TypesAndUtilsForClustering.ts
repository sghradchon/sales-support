/** 1つのクラスタデータ */
export type ClusterData = {
    texts: string[];
    summary: string;
  };
  
  /** 全クラスタ: clusterId(文字列) -> ClusterData */
  export type ClustersMap = Record<string, ClusterData>;
  
  /** Lambdaから返る全体の形式 */
  export type ClustersResponse = {
    clusters: ClustersMap;
  };