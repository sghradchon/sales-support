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

  export interface TextFileData {
    // JSONファイルの中身の構造を想定
    isClusterd: boolean;
    texts: string[];
    [key: string]: any; // 他の情報があってもよい
  }
  