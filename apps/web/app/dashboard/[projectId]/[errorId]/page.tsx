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

  useEffect(() => {
    if (!getToken()) { router.push('/'); return }
    apiFetch<ErrorDetail>(`/api/errors/${errorId}`).then(setError).catch(console.error)
  }, [errorId, router])

  async function analyze() {
    setAnalyzing(true)
    setAnalysis('')
    setAnalyzeError('')
    try {
      const { analysis: text } = await apiFetch<{ analysis: string }>(`/api/errors/${errorId}/analyze`, {
        method: 'POST',
      })
      setAnalysis(text)
    } catch (err) {
      const msg = (err as Error).message
      setAnalyzeError(msg.includes('NO_OPENAI_KEY') ? 'Add an OpenAI key in project settings to use AI analysis.' : msg)
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

  if (!error) return <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">Loading…</div>

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push(`/dashboard/${projectId}`)} className="text-zinc-500 hover:text-zinc-300 text-sm">
          ← Errors
        </button>
        <span className="font-semibold text-sm truncate">{error.error_type}</span>
        <div className="flex gap-2 ml-auto">
          {['open', 'resolved', 'ignored'].map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              disabled={updating || error.status === s}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                error.status === s
                  ? 'border-zinc-600 text-zinc-300 bg-zinc-800'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <p className="font-mono text-zinc-200 text-sm leading-relaxed">{error.message}</p>
          <p className="text-xs text-zinc-500 mt-2">
            First seen {new Date(error.first_seen).toLocaleString()} · {error.count} occurrence{error.count !== 1 ? 's' : ''}
          </p>
        </div>

        {error.stack_trace && (
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">Stack trace</p>
            <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {error.stack_trace}
            </pre>
          </div>
        )}

        <div>
          <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">AI Analysis</p>
          {analysis ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 leading-relaxed">
              {analysis}
            </div>
          ) : (
            <div>
              <button
                onClick={analyze}
                disabled={analyzing}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {analyzing ? 'Analyzing…' : 'Analyze with AI →'}
              </button>
              {analyzeError && <p className="text-red-400 text-xs mt-2">{analyzeError}</p>}
            </div>
          )}
        </div>

        {error.occurrences.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">
              Recent occurrences
            </p>
            <div className="flex flex-col gap-1">
              {error.occurrences.map((o) => (
                <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-400">
                  <span>{new Date(o.created_at).toLocaleString()}</span>
                  {o.url && <span className="ml-3 text-zinc-600 truncate">{o.url}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
