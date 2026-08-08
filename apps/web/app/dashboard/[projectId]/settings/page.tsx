'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getToken } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function ProjectSettings({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!getToken()) { router.push('/'); return }
    apiFetch<{ id: string; api_key: string }[]>('/api/projects').then((projects) => {
      const p = projects.find((x) => x.id === projectId)
      if (p) setApiKey(p.api_key)
    })
  }, [projectId, router])

  async function saveOpenaiKey(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await apiFetch(`/api/projects/${projectId}/openai-key`, {
        method: 'PATCH',
        body: JSON.stringify({ openai_key: openaiKey }),
      })
      setSaved(true)
      setOpenaiKey('')
    } finally {
      setSaving(false)
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sdkSnippet = `<script>
(function() {
  var T = '${apiKey}', U = '${API_URL}';
  window.onerror = function(msg, src, line, col, err) {
    fetch(U + '/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': T },
      body: JSON.stringify({
        message: msg,
        stack: err ? err.stack : null,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      })
    }).catch(function() {});
  };
  window.addEventListener('unhandledrejection', function(e) {
    window.onerror(
      e.reason instanceof Error ? e.reason.message : String(e.reason),
      null, null, null,
      e.reason instanceof Error ? e.reason : null
    );
  });
})();
<\/script>`

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push(`/dashboard/${projectId}`)} className="text-zinc-500 hover:text-zinc-300 text-sm">
          ← Errors
        </button>
        <span className="font-semibold text-sm">Settings</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">API Key</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs font-mono text-zinc-300 select-all">
              {apiKey}
            </code>
            <button
              onClick={copyKey}
              className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs rounded-md px-3 py-2"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-wider">SDK Snippet</p>
          <p className="text-xs text-zinc-600 mb-2">Paste this before your closing &lt;/body&gt; tag.</p>
          <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap">
            {sdkSnippet}
          </pre>
        </div>

        <div>
          <p className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-wider">OpenAI Key (BYOK)</p>
          <p className="text-xs text-zinc-600 mb-2">
            Optional. Used for AI error analysis. Stored encrypted — never logged or shared.
          </p>
          <form onSubmit={saveOpenaiKey} className="flex gap-2">
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600 font-mono"
            />
            <button
              type="submit"
              disabled={saving || !openaiKey}
              className="bg-zinc-100 text-zinc-900 rounded-md px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
            >
              {saving ? '...' : 'Save'}
            </button>
          </form>
          {saved && <p className="text-green-400 text-xs mt-2">Key saved.</p>}
        </div>
      </main>
    </div>
  )
}
