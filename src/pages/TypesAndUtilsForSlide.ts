
export interface Product {
  id:string;
  s3ImageUri:string;
  name:string;
  description:string;
  partIds:string[];
}

export interface Part {
    id:string;
    s3ImageUri:string;
    name:string;
    description:string;
  }

export const castProductAWSToInterface = (data: any[]) => {
    return data.map((item) => {
        return {
          id: item.id ?? '',
          s3ImageUri: item.s3ImageUri ?? '',
          name: item.name ?? '',
          description: item.description ?? '',
          partIds: item.partIds ?? '',
        };
    });
  };
  
  export const castPartAWSToInterface = (data: any[]) => {
    return data.map((item) => {
        return {
          id: item.id ?? '',
          s3ImageUri: item.s3ImageUri ?? '',
          name: item.name ?? '',
          description: item.description ?? '',
        };
    });
  };