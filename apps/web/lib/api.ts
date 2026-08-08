const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tracer_token') : null

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }

  return res.json() as T
}

export function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('tracer_token') : null
}

export function setToken(token: string) {
  localStorage.setItem('tracer_token', token)
}

export function clearToken() {
  localStorage.removeItem('tracer_token')
}
