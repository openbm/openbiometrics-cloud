import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'

interface UsageStats {
  total_calls: number
  avg_response_time_ms: number
  error_rate_percent: number
  by_endpoint: Record<string, number>
  daily: Record<string, number>
  monthly_usage: number
  monthly_limit: number
  plan: string
}

export default function Usage() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/usage/stats?days=${days}`)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  const chartData = Object.entries(stats?.daily || {}).map(([date, count]) => ({
    date: date.slice(5), // MM-DD
    calls: count,
  }))

  const endpointData = Object.entries(stats?.by_endpoint || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Usage</h1>
          <p className="mt-1 text-sm text-gray-400">Monitor your API usage and performance</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                days === d
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-6 sm:grid-cols-3 mb-8">
        <div className="rounded-xl border border-white/5 bg-[#111111] p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Calls</p>
          <p className="mt-2 text-2xl font-bold">{stats?.total_calls?.toLocaleString() || 0}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#111111] p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Response</p>
          <p className="mt-2 text-2xl font-bold">{stats?.avg_response_time_ms || 0}ms</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#111111] p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Error Rate</p>
          <p className="mt-2 text-2xl font-bold">{stats?.error_rate_percent || 0}%</p>
        </div>
      </div>

      {/* Daily chart */}
      <div className="rounded-xl border border-white/5 bg-[#111111] p-6 mb-8">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Daily API Calls</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px' }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#818cf8' }}
              />
              <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-gray-500">No usage data yet. Make your first API call.</p>
        )}
      </div>

      {/* By endpoint */}
      <div className="rounded-xl border border-white/5 bg-[#111111] p-6">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Calls by Endpoint</h3>
        {endpointData.length > 0 ? (
          <div className="space-y-3">
            {endpointData.map(([endpoint, count]) => {
              const maxCount = endpointData[0][1]
              const width = (count / maxCount) * 100
              return (
                <div key={endpoint}>
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs text-gray-300 font-mono">{endpoint}</code>
                    <span className="text-xs text-gray-500">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500/60" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-gray-500">No endpoint data yet.</p>
        )}
      </div>
    </div>
  )
}
