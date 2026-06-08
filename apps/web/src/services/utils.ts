import { api } from './api'
import type { DataEnvelope, User } from '@chess/shared'

export function getUser(id: string) {
  return api<DataEnvelope<User>>(`users/${id}`)
}

export function updateElo(id: string, delta: number) {
  return api<DataEnvelope<User>>(`users/${id}/elo`, { delta }, { method: 'PATCH' })
}