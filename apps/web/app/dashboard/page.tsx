'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, clearToken, getToken } from '@/lib/api'

interface Project {
  id: string
  name: string
  api_key: string
  created_at: string
}

export default function Dashboard() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getToken()) { router.push('/'); return }
    apiFetch<Project[]>('/api/projects').then(setProjects).catch(() => {
      clearToken(); router.push('/')
    })
  }, [router])

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError('')
    try {
      const p = await apiFetch<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      setProjects((prev) => [p, ...prev])
      setName('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold tracking-tight">Tracer</span>
        <button
          onClick={() => { clearToken(); router.push('/') }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h2 className="text-lg font-semibold mb-6">Projects</h2>

        <form onSubmit={createProject} className="flex gap-2 mb-8">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-zinc-100 text-zinc-900 rounded-md px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            {creating ? '...' : 'Create'}
          </button>
        </form>
        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <div className="flex flex-col gap-2">
          {projects.length === 0 && (
            <p className="text-zinc-500 text-sm">No projects yet. Create one above.</p>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/dashboard/${p.id}`)}
              className="text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-3 transition-colors"
            >
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs text-zinc-500 mt-0.5 font-mono">{p.id.slice(0, 8)}…</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
