'use client'

import { useState, useEffect, useRef } from 'react'

const API_URL = 'https://api-2c50-3001.prg1.zerops.app'
// Replace with your demo project API key after creating one in Settings
const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY ?? 'YOUR_DEMO_API_KEY'

interface CapturedError {
  message: string
  type: string
  time: string
  ok: boolean
}

const DEMO_ERRORS = [
  {
    label: 'Orders page crash',
    description: 'New users get a blank screen on /orders',
    scenario: 'User opens their Orders page → API returns null instead of [] → app crashes',
    fn: () => {
      const orders: null = null
      // @ts-expect-error intentional
      return orders.map((o: unknown) => o)
    },
  },
  {
    label: 'Missing utility function',
    description: 'Checkout shows NaN for all prices',
    scenario: 'formatCurrency() was moved to utils.ts but the old import was never updated',
    fn: () => {
      // @ts-expect-error intentional
      return formatCurrency(99.99)
    },
  },
  {
    label: 'Payment gateway timeout',
    description: 'Checkout fails silently for some users',
    scenario: 'Payment API returns 503 during high traffic — unhandled promise rejection',
    fn: () => {
      return Promise.reject(new Error('Payment gateway timeout: 503 Service Unavailable'))
    },
  },
]

export default function DemoPage() {
  const [captured, setCaptured] = useState<CapturedError[]>([])
  const [throwing, setThrowing] = useState<number | null>(null)
  const tracerInstalled = useRef(false)

  useEffect(() => {
    if (tracerInstalled.current) return
    tracerInstalled.current = true

    function sendToTracer(msg: string, stack: string | null) {
      fetch(API_URL + '/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': DEMO_API_KEY },
        body: JSON.stringify({
          message: msg,
          stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          setCaptured((prev) => [{
            message: msg.slice(0, 80),
            type: msg.split(':')[0] || 'Error',
            time: new Date().toLocaleTimeString(),
            ok: d.ok === true,
          }, ...prev])
        })
        .catch(() => {
          setCaptured((prev) => [{
            message: msg.slice(0, 80),
            type: 'Error',
            time: new Date().toLocaleTimeString(),
            ok: false,
          }, ...prev])
        })
    }

    window.onerror = (_msg, _src, _line, _col, err) => {
      sendToTracer(err?.message || String(_msg), err?.stack || null)
      return true
    }

    window.addEventListener('unhandledrejection', (e) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
      const stack = e.reason instanceof Error ? e.reason.stack || null : null
      sendToTracer(msg, stack)
    })
  }, [])

  function triggerError(index: number) {
    setThrowing(index)
    setTimeout(() => {
      try {
        const result = DEMO_ERRORS[index].fn()
        if (result instanceof Promise) {
          result.catch(() => {})
        }
      } catch (e) {
        window.onerror?.('', '', 0, 0, e as Error)
      }
      setThrowing(null)
    }, 300)
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Fake SaaS header */}
      <header className="border-b border-zinc-800/60 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-violet-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span className="text-zinc-100 font-semibold text-sm">ShopFlow</span>
            </div>
            <nav className="hidden sm:flex gap-1">
              {['Dashboard', 'Orders', 'Products', 'Analytics', 'Settings'].map((item) => (
                <button key={item}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    item === 'Orders'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {item}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center">
              <span className="text-zinc-300 text-xs font-medium">H</span>
            </div>
            <div className="hidden sm:block">
              <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                ← Open Tracer dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Fake app content — looks like a real SaaS */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Orders</h1>
            <p className="text-sm text-zinc-500">Manage customer orders and fulfillment</p>
          </div>
          <button className="bg-violet-500 text-white text-sm px-3.5 py-2 rounded-lg font-medium opacity-60 cursor-not-allowed">
            Export CSV
          </button>
        </div>

        {/* Fake stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Orders', value: '2,847' },
            { label: 'Revenue', value: '$184,320' },
            { label: 'Pending', value: '23' },
            { label: 'Refunds', value: '7' },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-xl font-semibold text-zinc-100">{s.value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Fake orders table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Recent Orders</span>
            <span className="text-xs text-zinc-500">Showing 5 of 2,847</span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {[
              { id: '#ORD-4821', customer: 'Sarah Chen', product: 'Pro Plan × 1', amount: '$49.00', status: 'Paid' },
              { id: '#ORD-4820', customer: 'Marcus Webb', product: 'Starter Plan × 1', amount: '$12.00', status: 'Paid' },
              { id: '#ORD-4819', customer: 'Priya Nair', product: 'Pro Plan × 3', amount: '$147.00', status: 'Pending' },
              { id: '#ORD-4818', customer: 'Tom Bradley', product: 'Enterprise × 1', amount: '$299.00', status: 'Paid' },
              { id: '#ORD-4817', customer: 'Diana Ruiz', product: 'Starter Plan × 2', amount: '$24.00', status: 'Refunded' },
            ].map((order) => (
              <div key={order.id} className="px-4 py-3 flex items-center gap-4 text-sm">
                <span className="text-zinc-500 font-mono text-xs w-20 flex-shrink-0">{order.id}</span>
                <span className="text-zinc-300 flex-1">{order.customer}</span>
                <span className="text-zinc-500 hidden sm:block flex-1">{order.product}</span>
                <span className="text-zinc-200 font-medium w-20 text-right flex-shrink-0">{order.amount}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  order.status === 'Paid' ? 'bg-green-500/10 text-green-400' :
                  order.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-red-500/10 text-red-400'
                }`}>{order.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* --- Tracer Demo Section --- */}
        <div className="border-t border-zinc-800/60 pt-8">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-7 h-7 rounded-md bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white font-bold text-xs">T</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Tracer SDK — Live Demo</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                The Tracer SDK is installed on this page. Trigger a real bug below and watch it appear in your dashboard.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {DEMO_ERRORS.map((err, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-200">{err.label}</span>
                  <span className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">bug</span>
                </div>
                <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{err.description}</p>
                <p className="text-xs text-zinc-600 italic mb-3 leading-relaxed">{err.scenario}</p>
                <button
                  onClick={() => triggerError(i)}
                  disabled={throwing !== null}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {throwing === i ? 'Triggering…' : 'Trigger this bug →'}
                </button>
              </div>
            ))}
          </div>

          {/* Live capture log */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Capture Log</span>
              {captured.length > 0 && (
                <span className="text-xs text-zinc-600">{captured.length} captured this session</span>
              )}
            </div>
            <div className="p-3 h-32 overflow-y-auto font-mono">
              {captured.length === 0 ? (
                <p className="text-zinc-600 text-xs">Waiting for errors to be triggered…</p>
              ) : (
                captured.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs mb-1">
                    <span className={c.ok ? 'text-green-400' : 'text-red-400'}>{c.ok ? '✓' : '✗'}</span>
                    <span className="text-zinc-500">{c.time}</span>
                    <span className="text-orange-400 flex-shrink-0">{c.type}:</span>
                    <span className="text-zinc-300 truncate">{c.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {captured.length > 0 && (
            <p className="text-xs text-zinc-500 mt-3 text-center">
              ↑ Now open{' '}
              <a href="/" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                your Tracer dashboard
              </a>{' '}
              — the errors are there.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
