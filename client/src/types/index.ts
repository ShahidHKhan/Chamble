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

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
};

export type Friend = {
  id: string;
  displayName: string;
  status: "online" | "offline" | "in-game";
};
