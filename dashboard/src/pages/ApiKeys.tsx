import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'

interface ApiKeyItem {
  id: string
  name: string
  key_prefix: string
  environment: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
  raw_key?: string
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('Default')
  const [newKeyEnv, setNewKeyEnv] = useState('test')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function fetchKeys() {
    try {
      const data = await api.get('/api/tenants/api-keys')
      setKeys(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchKeys() }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const data = await api.post('/api/tenants/api-keys', { name: newKeyName, environment: newKeyEnv })
      setCreatedKey(data.raw_key)
      setShowCreate(false)
      fetchKeys()
    } catch {}
    setCreating(false)
  }

  async function handleRevoke(id: string) {
    if (!confirm('Are you sure? This key will stop working immediately.')) return
    try {
      await api.delete(`/api/tenants/api-keys/${id}`)
      fetchKeys()
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-sm text-gray-400">Manage your API keys for authentication</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          Create Key
        </button>
      </div>

      {/* Created key banner */}
      {createdKey && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-400 mb-2">New API key created. Copy it now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm font-mono text-gray-200 select-all">
              {createdKey}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(createdKey); }}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5"
            >
              Copy
            </button>
            <button
              onClick={() => setCreatedKey(null)}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-6">
            <h2 className="text-lg font-semibold mb-4">Create API Key</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Environment</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv('test')}
                    className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                      newKeyEnv === 'test'
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    Test (ob_test_)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv('live')}
                    className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                      newKeyEnv === 'live'
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    Live (ob_live_)
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Keys table */}
      <div className="rounded-xl border border-white/5 bg-[#111111] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Environment</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                  No API keys yet. Create one to get started.
                </td>
              </tr>
            ) : (
              keys.map(key => (
                <tr key={key.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-gray-200">{key.name}</td>
                  <td className="px-5 py-3">
                    <code className="rounded bg-white/5 px-2 py-1 text-xs text-gray-400 font-mono">{key.key_prefix}...
                    </code>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      key.environment === 'live'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {key.environment}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      key.is_active
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {key.is_active && (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
