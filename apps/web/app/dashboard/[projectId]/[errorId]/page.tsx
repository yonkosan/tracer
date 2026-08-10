'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getToken } from '@/lib/api'

interface Occurrence {
  id: string
  url: string | null
  user_agent: string | null
  created_at: string
}

interface ErrorDetail {
  id: string
  message: string
  error_type: string
  stack_trace: string | null
  status: string
  count: number
  first_seen: string
  last_seen: string
  occurrences: Occurrence[]
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

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400 border-red-500/20',
  resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
  ignored: 'bg-zinc-800 text-zinc-500 border-zinc-700',
}

export default function ErrorDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; errorId: string }>
}) {
  const { projectId, errorId } = use(params)
  const router = useRouter()
  const [error, setError] = useState<ErrorDetail | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!getToken()) { router.push('/'); return }
    apiFetch<ErrorDetail>(`/api/errors/${errorId}`).then(setError).catch(console.error)
  }, [errorId, router])

  async function analyze() {
    setAnalyzing(true)
    setAnalysis('')
    setAnalyzeError('')
    try {
      const { analysis: text } = await apiFetch<{ analysis: string }>(
        `/api/errors/${errorId}/analyze`, { method: 'POST' }
      )
      setAnalysis(text)
    } catch (err) {
      const msg = (err as Error).message
      setAnalyzeError(
        msg.includes('NO_OPENAI_KEY')
          ? 'Add an OpenAI key in project Settings to enable AI analysis.'
          : msg
      )
    } finally {
      setAnalyzing(false)
    }
  }

  async function updateStatus(status: string) {
    if (!error) return
    setUpdating(true)
    try {
      await apiFetch(`/api/errors/${errorId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setError((e) => e ? { ...e, status } : e)
    } finally {
      setUpdating(false)
    }
  }

  function copyStack() {
    if (error?.stack_trace) {
      navigator.clipboard.writeText(error.stack_trace)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.push(`/dashboard/${projectId}`)}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 text-sm transition-colors">
            <span className="text-base leading-none">←</span>
            Errors
          </button>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-500 text-sm font-mono">{error.error_type}</span>
          <div className="ml-auto flex gap-2">
            {['open', 'resolved', 'ignored'].map((s) => (
              <button key={s} onClick={() => updateStatus(s)} disabled={updating || error.status === s}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                  error.status === s
                    ? STATUS_STYLES[s]
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Error header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono font-semibold bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded">
              {error.error_type}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_STYLES[error.status]}`}>
              {error.status}
            </span>
          </div>
          <p className="text-zinc-100 font-mono text-sm leading-relaxed mb-3">{error.message}</p>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span><span className="text-zinc-400 font-semibold">{error.count}</span> occurrence{error.count !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>First seen {timeAgo(error.first_seen)}</span>
            <span>·</span>
            <span>Last seen {timeAgo(error.last_seen)}</span>
          </div>
        </div>

        {/* Stack trace */}
        {error.stack_trace && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Stack Trace</span>
              <button onClick={copyStack}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {error.stack_trace}
            </pre>
          </div>
        )}

        {/* AI Analysis */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">AI Analysis</span>
          </div>
          <div className="p-4">
            {analysis ? (
              <div className="text-sm text-zinc-200 leading-relaxed">{analysis}</div>
            ) : (
              <div>
                <p className="text-sm text-zinc-500 mb-3">
                  Let AI explain what caused this error and how to fix it.
                </p>
                <button onClick={analyze} disabled={analyzing}
                  className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
                  {analyzing ? (
                    <><span className="animate-pulse">●</span> Analyzing…</>
                  ) : (
                    <>✨ Analyze with AI</>
                  )}
                </button>
                {analyzeError && (
                  <p className="text-red-400 text-xs mt-2">{analyzeError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Occurrences */}
        {error.occurrences.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Recent Occurrences
              </span>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {error.occurrences.map((o) => (
                <div key={o.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {o.url && (
                      <p className="text-xs text-zinc-400 truncate mb-0.5 font-mono">{o.url}</p>
                    )}
                    {o.user_agent && (
                      <p className="text-xs text-zinc-600 truncate">{o.user_agent}</p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 flex-shrink-0">
                    {new Date(o.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
