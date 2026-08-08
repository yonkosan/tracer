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
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Tracer</h1>
          <p className="mt-2 text-zinc-400 text-sm">
            One script tag. Every error, captured.
          </p>
        </div>

        <div className="flex gap-4 mb-6 text-sm">
          <button
            onClick={() => setMode('login')}
            className={mode === 'login' ? 'text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-300'}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('register')}
            className={mode === 'register' ? 'text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-300'}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-zinc-100 text-zinc-900 rounded-md px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-50 mt-1"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-8 text-xs text-zinc-600 text-center">
          <a href="/demo" className="hover:text-zinc-400 underline">
            Try the live demo →
          </a>
        </p>
      </div>
    </main>
  )
}
