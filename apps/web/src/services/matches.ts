import { api } from './api'
import type { DataEnvelope, DataListEnvelope, MatchRecord } from '@chess/shared'

export function getMatches(userId: string) {
  return api<DataListEnvelope<MatchRecord>>(`matches/user/${userId}`)
}

export function recordMatch(match: Omit<MatchRecord, 'id'>) {
  return api<DataEnvelope<MatchRecord>>('matches', match)
}