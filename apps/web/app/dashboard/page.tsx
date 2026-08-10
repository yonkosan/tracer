'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, clearToken, getToken } from '@/lib/api'

interface Project {
  id: string
  name: string
  api_key: string
  created_at: string
  open_errors: number
  total_errors: number
  last_error_at: string | null
}

function timeAgo(iso: string | null) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Dashboard() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [showForm, setShowForm] = useState(false)

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
    setFormError('')
    try {
      const p = await apiFetch<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      setProjects((prev) => [{ ...p, open_errors: 0, total_errors: 0, last_error_at: null }, ...prev])
      setName('')
      setShowForm(false)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const totalOpen = projects.reduce((s, p) => s + Number(p.open_errors || 0), 0)

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-indigo-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">T</span>
            </div>
            <span className="text-zinc-50 font-semibold text-sm">Tracer</span>
          </div>
          <button onClick={() => { clearToken(); router.push('/') }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Projects</h1>
            {totalOpen > 0 && (
              <p className="text-sm text-zinc-400 mt-0.5">
                <span className="text-red-400 font-medium">{totalOpen}</span> open {totalOpen === 1 ? 'error' : 'errors'} across all projects
              </p>
            )}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors">
            + New project
          </button>
        </div>

        {showForm && (
          <div className="mb-5 bg-zinc-900 border border-zinc-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-zinc-200 mb-3">New project</h3>
            <form onSubmit={createProject} className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Web App, Checkout Service…" autoFocus
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-50 outline-none focus:border-indigo-500 placeholder:text-zinc-600" />
              <button type="button" onClick={() => { setShowForm(false); setFormError('') }}
                className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={creating || !name.trim()}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </form>
            {formError && <p className="text-red-400 text-xs mt-2">{formError}</p>}
          </div>
        )}

        {projects.length === 0 && !showForm && (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl">
            <p className="text-4xl mb-4">🎯</p>
            <p className="text-zinc-300 font-medium mb-1">No projects yet</p>
            <p className="text-zinc-500 text-sm mb-5">Create a project to get your API key and start capturing errors.</p>
            <button onClick={() => setShowForm(true)}
              className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Create your first project
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const open = Number(p.open_errors || 0)
            const total = Number(p.total_errors || 0)
            const ago = timeAgo(p.last_error_at)
            return (
              <button key={p.id} onClick={() => router.push(`/dashboard/${p.id}`)}
                className="text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-zinc-100 text-sm leading-snug group-hover:text-white transition-colors">{p.name}</h3>
                  {open > 0 && (
                    <span className="flex-shrink-0 ml-2 bg-red-500/15 text-red-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {open} open
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{total === 0 ? 'No errors yet' : `${total} total error${total !== 1 ? 's' : ''}`}</span>
                  {ago && <><span>·</span><span>Last {ago}</span></>}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-800/60 text-xs text-zinc-600">
                  Created {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
