'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getToken } from '@/lib/api'

interface TracerError {
  id: string
  message: string
  error_type: string
  status: 'open' | 'resolved' | 'ignored'
  count: number
  first_seen: string
  last_seen: string
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-red-500/20 text-red-400',
  resolved: 'bg-green-500/20 text-green-400',
  ignored: 'bg-zinc-700 text-zinc-400',
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ProjectErrors({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  const [errors, setErrors] = useState<TracerError[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  const fetchErrors = useCallback(async () => {
    if (!getToken()) { router.push('/'); return }
    try {
      if (query.trim()) {
        const results = await apiFetch<TracerError[]>(`/api/errors/search?q=${encodeURIComponent(query)}&projectId=${projectId}`)
        setErrors(results)
      } else {
        const qs = status ? `&status=${status}` : ''
        const { errors: list, total: t } = await apiFetch<{ errors: TracerError[]; total: number }>(
          `/api/errors?projectId=${projectId}${qs}`
        )
        setErrors(list)
        setTotal(t)
      }
    } catch {
      // token expired or project not found
    }
  }, [projectId, query, status, router])

  useEffect(() => {
    fetchErrors()
    const id = setInterval(fetchErrors, 3000)
    return () => clearInterval(id)
  }, [fetchErrors])

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-zinc-500 hover:text-zinc-300 text-sm">
          ← Projects
        </button>
        <span className="font-semibold text-sm">Errors</span>
        <span className="text-zinc-600 text-xs ml-auto">{total} total</span>
        <button
          onClick={() => router.push(`/dashboard/${projectId}/settings`)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Settings
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex gap-2 mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search errors…"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm outline-none focus:border-zinc-600 text-zinc-300"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>

        {errors.length === 0 && (
          <p className="text-zinc-500 text-sm">
            {query ? 'No matching errors.' : 'No errors yet — integrate the SDK to start capturing.'}
          </p>
        )}

        <div className="flex flex-col gap-1">
          {errors.map((err) => (
            <button
              key={err.id}
              onClick={() => router.push(`/dashboard/${projectId}/${err.id}`)}
              className="text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono text-zinc-200 truncate">{err.message}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{err.error_type}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-zinc-500">{relativeTime(err.last_seen)}</span>
                  {err.count > 1 && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      ×{err.count}
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[err.status]}`}>
                    {err.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
