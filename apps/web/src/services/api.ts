const API_BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

export async function api<T>(
  endpoint: string,
  data?: unknown,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}/api/v1/${endpoint.replace(/^\/+/, '')}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Attach auth token if available
  const token = localStorage.getItem('chamble_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    method: data ? 'POST' : 'GET',
    body: data ? JSON.stringify(data) : undefined,
    ...options,
    headers,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res.statusText }))
    const err = new Error(errBody.message ?? 'Request failed') as Error & { data?: unknown }
    err.data = errBody.data
    throw err
  }

  return res.json()
}