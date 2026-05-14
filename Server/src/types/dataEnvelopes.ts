export type DataEnvelope<T> = {
  data: T | null;
  isSuccess: boolean;
  message?: string;
};

export type DataListEnvelope<T> = DataEnvelope<T[]> & {
  total: number;
};

export type PagingRequest = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  descending?: boolean;
};
