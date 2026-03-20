import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface BillingInfo {
  plan: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  portal_url: string | null
}

const plans = [
  { id: 'free', name: 'Free', price: '$0', calls: '100', features: ['Self-hosted engine', 'Community support', '100 cloud calls/mo'] },
  { id: 'developer', name: 'Developer', price: '$29', calls: '10,000', features: ['10K API calls/mo', 'All modules', 'Email support', 'Dashboard analytics'] },
  { id: 'pro', name: 'Pro', price: '$99', calls: '100,000', features: ['100K API calls/mo', 'Higher rate limits', 'Priority support', 'Webhooks & events'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', calls: 'Unlimited', features: ['Unlimited calls', 'Dedicated infra', 'SLA', '24/7 support'] },
]

export default function Billing() {
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/billing/')
      .then(setBilling)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleUpgrade(planId: string) {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:hello@openbiometrics.dev?subject=Enterprise Plan'
      return
    }
    if (planId === 'free') return
    setUpgrading(planId)
    try {
      const data = await api.post('/api/billing/checkout', { plan: planId })
      if (data.checkout_url) window.location.href = data.checkout_url
    } catch (err: any) {
      alert(err.message || 'Failed to create checkout session')
    }
    setUpgrading(null)
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-gray-400">
          Current plan: <span className="capitalize text-indigo-400 font-medium">{billing?.plan || 'free'}</span>
        </p>
      </div>

      {billing?.portal_url && (
        <div className="mb-8 rounded-xl border border-white/5 bg-[#111111] p-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-200">Manage subscription</h3>
            <p className="text-xs text-gray-500 mt-1">Update payment method, view invoices, or cancel</p>
          </div>
          <a
            href={billing.portal_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5"
          >
            Billing Portal
          </a>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => {
          const isCurrent = billing?.plan === plan.id
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 transition ${
                isCurrent
                  ? 'border-indigo-500/30 bg-indigo-500/5'
                  : 'border-white/5 bg-[#111111]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{plan.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-400">Current</span>
                )}
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.price !== 'Custom' && <span className="text-gray-500">/mo</span>}
              </div>
              <p className="mt-1 text-xs text-gray-500">{plan.calls} API calls/mo</p>

              <ul className="mt-5 space-y-2">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                    <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || upgrading === plan.id}
                className={`mt-6 w-full rounded-lg py-2 text-sm font-medium transition ${
                  isCurrent
                    ? 'border border-white/10 text-gray-500 cursor-default'
                    : plan.id === 'developer'
                    ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                    : 'border border-white/10 text-gray-300 hover:bg-white/5'
                } disabled:opacity-50`}
              >
                {isCurrent ? 'Current Plan' : upgrading === plan.id ? 'Loading...' : plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
