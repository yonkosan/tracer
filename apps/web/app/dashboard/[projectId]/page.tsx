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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  open:     { label: 'Open',     dot: 'bg-red-500',    badge: 'bg-red-500/10 text-red-400' },
  resolved: { label: 'Resolved', dot: 'bg-green-500',  badge: 'bg-green-500/10 text-green-400' },
  ignored:  { label: 'Ignored',  dot: 'bg-zinc-600',   badge: 'bg-zinc-800 text-zinc-500' },
}

const TYPE_COLORS: Record<string, string> = {
  TypeError:      'bg-orange-500/10 text-orange-400',
  ReferenceError: 'bg-yellow-500/10 text-yellow-400',
  SyntaxError:    'bg-purple-500/10 text-purple-400',
  Error:          'bg-red-500/10 text-red-400',
}

function typeColor(type: string) {
  return TYPE_COLORS[type] || 'bg-zinc-800 text-zinc-400'
}

export default function ProjectErrors({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  const [errors, setErrors] = useState<TracerError[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [projectName, setProjectName] = useState('')

  const fetchErrors = useCallback(async () => {
    if (!getToken()) { router.push('/'); return }
    try {
      if (query.trim()) {
        const results = await apiFetch<TracerError[]>(
          `/api/errors/search?q=${encodeURIComponent(query)}&projectId=${projectId}`
        )
        setErrors(results)
      } else {
        const qs = statusFilter ? `&status=${statusFilter}` : ''
        const { errors: list, total: t } = await apiFetch<{ errors: TracerError[]; total: number }>(
          `/api/errors?projectId=${projectId}${qs}`
        )
        setErrors(list)
        setTotal(t)
      }
    } catch { /* silent */ }
  }, [projectId, query, statusFilter, router])

  useEffect(() => {
    // fetch project name
    apiFetch<Array<{ id: string; name: string }>>('/api/projects').then((ps) => {
      const p = ps.find((x) => x.id === projectId)
      if (p) setProjectName(p.name)
    }).catch(() => {})
    fetchErrors()
    const id = setInterval(fetchErrors, 3000)
    return () => clearInterval(id)
  }, [fetchErrors, projectId])

  const open = errors.filter(e => e.status === 'open').length
  const resolved = errors.filter(e => e.status === 'resolved').length
  const ignored = errors.filter(e => e.status === 'ignored').length

  const tabs = [
    { label: 'All', value: '', count: total },
    { label: 'Open', value: 'open', count: null },
    { label: 'Resolved', value: 'resolved', count: null },
    { label: 'Ignored', value: 'ignored', count: null },
  ]

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 text-sm transition-colors">
            <span className="text-base leading-none">←</span>
            Projects
          </button>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-200 text-sm font-medium">{projectName || '…'}</span>
          <div className="ml-auto">
            <button onClick={() => router.push(`/dashboard/${projectId}/settings`)}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors">
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Stats bar */}
        {total > 0 && !query && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total', value: total, color: 'text-zinc-100' },
              { label: 'Open', value: errors.filter(e=>e.status==='open').length || '-', color: 'text-red-400' },
              { label: 'Resolved', value: errors.filter(e=>e.status==='resolved').length || '-', color: 'text-green-400' },
              { label: 'Ignored', value: errors.filter(e=>e.status==='ignored').length || '-', color: 'text-zinc-500' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <div className={`text-xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search + filter */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search errors by message, type, or stack trace…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-50 outline-none focus:border-indigo-500/60 placeholder:text-zinc-600 transition-colors" />
          </div>
          {!query && (
            <div className="flex border border-zinc-800 rounded-lg overflow-hidden">
              {tabs.map((t) => (
                <button key={t.value} onClick={() => setStatusFilter(t.value)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    statusFilter === t.value
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}>
                  {t.label}
                  {t.count !== null && <span className="ml-1 text-zinc-600">{t.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error list */}
        {errors.length === 0 && (
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl">
            <p className="text-3xl mb-3">✨</p>
            <p className="text-zinc-300 font-medium mb-1">
              {query ? 'No matching errors' : 'No errors yet'}
            </p>
            <p className="text-zinc-500 text-sm">
              {query ? 'Try a different search term' : 'Add the SDK to your app to start capturing errors.'}
            </p>
          </div>
        )}

        <div className="flex flex-col divide-y divide-zinc-800/60 border border-zinc-800 rounded-xl overflow-hidden">
          {errors.map((err) => (
            <button key={err.id}
              onClick={() => router.push(`/dashboard/${projectId}/${err.id}`)}
              className="text-left px-4 py-3.5 hover:bg-zinc-900/60 transition-colors group">
              <div className="flex items-start gap-3">
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS[err.status]?.dot || 'bg-zinc-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ${typeColor(err.error_type)}`}>
                      {err.error_type}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">
                    {err.message}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xs text-zinc-500">{timeAgo(err.last_seen)}</span>
                  {err.count > 1 && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                      ×{err.count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
