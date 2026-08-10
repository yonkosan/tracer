'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, setToken } from '@/lib/api'

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const { token } = await apiFetch<{ token: string }>(path, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setToken(token)
      router.push('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <div>
            <div className="text-zinc-50 font-semibold leading-tight">Tracer</div>
            <div className="text-zinc-500 text-xs">Error tracking for developers</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h1 className="text-zinc-50 font-semibold text-lg mb-1">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="text-zinc-500 text-sm mb-5">
            {mode === 'login'
              ? 'Track and fix errors faster.'
              : 'Start capturing errors in minutes.'}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-50 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-50 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 placeholder:text-zinc-600 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-zinc-500 text-xs mt-4">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="text-center mt-4 text-xs text-zinc-600">
          <a href="/demo" className="hover:text-zinc-400 transition-colors">Try the live demo →</a>
        </p>
      </div>
    </main>
  )
}
