import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Stats {
  total_calls: number
  avg_response_time_ms: number
  error_rate_percent: number
  monthly_usage: number
  monthly_limit: number
  plan: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/usage/stats?days=30'),
      api.get('/api/tenants/me'),
    ])
      .then(([s, p]) => {
        setStats(s)
        setProfile(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  const usagePercent = stats ? Math.min(100, (stats.monthly_usage / stats.monthly_limit) * 100) : 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back{profile?.name ? `, ${profile.name}` : ''}</h1>
        <p className="mt-1 text-sm text-gray-400">
          Plan: <span className="capitalize text-indigo-400">{stats?.plan || 'free'}</span>
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="API Calls (30d)" value={stats?.total_calls?.toLocaleString() || '0'} />
        <StatCard label="Avg Response Time" value={`${stats?.avg_response_time_ms || 0}ms`} />
        <StatCard label="Error Rate" value={`${stats?.error_rate_percent || 0}%`} />
        <StatCard label="Monthly Usage" value={`${stats?.monthly_usage?.toLocaleString() || '0'} / ${stats?.monthly_limit?.toLocaleString() || '0'}`} />
      </div>

      {/* Usage bar */}
      <div className="mt-8 rounded-xl border border-white/5 bg-[#111111] p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">Monthly Usage</h3>
          <span className="text-sm text-gray-400">{usagePercent.toFixed(1)}%</span>
        </div>
        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <QuickLink
          title="Create API Key"
          description="Generate live or test keys"
          href="/api-keys"
        />
        <QuickLink
          title="View Documentation"
          description="API reference and guides"
          href="https://drinkredwine.github.io/openbiometrics/"
          external
        />
        <QuickLink
          title="Upgrade Plan"
          description="Get more API calls"
          href="/billing"
        />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#111111] p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function QuickLink({ title, description, href, external }: { title: string; description: string; href: string; external?: boolean }) {
  const Tag = external ? 'a' : 'a'
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group rounded-xl border border-white/5 bg-[#111111] p-5 transition hover:border-indigo-500/20"
    >
      <h3 className="text-sm font-medium text-white group-hover:text-indigo-400 transition">{title}</h3>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </a>
  )
}
