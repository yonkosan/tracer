'use client'

import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
// Demo project API key — set this to a real project key after creating one in the dashboard
const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY ?? 'demo-not-configured'

export default function DemoPage() {
  const [log, setLog] = useState<string[]>([])
  const [throwing, setThrowing] = useState(false)

  useEffect(() => {
    // Install Tracer SDK on this page — same code developers add to their apps
    window.onerror = function (msg, _src, _line, _col, err) {
      const payload = {
        message: typeof msg === 'string' ? msg : 'Unknown error',
        stack: err instanceof Error ? err.stack : null,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }
      fetch(`${API_URL}/api/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': DEMO_API_KEY },
        body: JSON.stringify(payload),
      })
        .then(() => setLog((l) => [`✓ Captured: ${payload.message.slice(0, 60)}`, ...l]))
        .catch(() => setLog((l) => ['✗ Ingest failed — check API key in settings', ...l]))

      return true // prevent default browser error handling
    }

    window.addEventListener('unhandledrejection', (e) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
      window.onerror!(msg, undefined, undefined, undefined, e.reason instanceof Error ? e.reason : undefined)
    })
  }, [])

  const errors = [
    () => { throw new TypeError("Cannot read properties of undefined (reading 'map')") },
    () => { throw new ReferenceError('user is not defined') },
    () => { throw new Error('Network request failed: 503 Service Unavailable') },
    () => Promise.reject(new Error('Unhandled promise: payment gateway timeout')),
  ]

  function throwError() {
    setThrowing(true)
    const fn = errors[Math.floor(Math.random() * errors.length)]
    setLog((l) => ['→ Throwing error…', ...l])
    setTimeout(() => {
      try { fn() } catch (e) {
        window.onerror!(
          (e as Error).message, undefined, undefined, undefined, e as Error
        )
      }
      setThrowing(false)
    }, 100)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold tracking-tight">Tracer — Live Demo</span>
        <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300">Sign in →</a>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8 max-w-lg mx-auto w-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Throw a real error</h2>
          <p className="text-sm text-zinc-400">
            The Tracer SDK is installed on this page. Click below — the error gets captured and
            shows up in the dashboard within seconds.
          </p>
        </div>

        <button
          onClick={throwError}
          disabled={throwing}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg py-4 text-base transition-colors disabled:opacity-60"
        >
          {throwing ? 'Throwing…' : 'Throw test error →'}
        </button>

        <div className="w-full">
          <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">Event log</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 h-40 overflow-y-auto font-mono">
            {log.length === 0 && (
              <p className="text-zinc-600 text-xs">Waiting for errors…</p>
            )}
            {log.map((entry, i) => (
              <p key={i} className={`text-xs ${entry.startsWith('✓') ? 'text-green-400' : entry.startsWith('✗') ? 'text-red-400' : 'text-zinc-500'}`}>
                {entry}
              </p>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Check the dashboard to see errors appear in real time. Open it in another tab.
        </p>
      </main>
    </div>
  )
}
