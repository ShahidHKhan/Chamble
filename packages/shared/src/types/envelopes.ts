// packages/shared/src/types/envelopes.ts
//
// Every REST response your server sends is wrapped in one of these.
// The client never has to guess the shape — it always checks
// response.isSuccess and reads response.data.
 
export interface DataEnvelope<T> {
  data: T
  isSuccess: boolean
  message?: string
}
 
export interface DataListEnvelope<T> extends DataEnvelope<T[]> {
  total: number
}
 
// The client sends these as query params for paginated endpoints.
// Models read them to build the Supabase .range() / .ilike() calls.
export interface PagingRequest {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  descending?: boolean
}
 