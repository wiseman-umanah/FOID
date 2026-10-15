import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import RemixIcon from '@/components/RemixIcon'
import StatCard from '@/components/StatCard'
import type { Wallet, WalletTransaction } from '@/types/idra'
import { api } from '@/lib/api'

/* ── Package definitions (mirrors backend _PACKAGES) ────────────────── */
type PkgKey = 'starter' | 'growth' | 'topup'

interface Package {
  key:       PkgKey
  name:      string
  credits:   number
  amountNgn: number
  badge:     string | null
  icon:      string
}

const PACKAGES: Package[] = [
  {
    key:       'topup',
    name:      'Quick Top-up',
    credits:   2_500,
    amountNgn: 12_500,
    badge:     null,
    icon:      'ri-flashlight-line',
  },
  {
    key:       'starter',
    name:      'Starter Pack',
    credits:   5_000,
    amountNgn: 25_000,
    badge:     'Best value',
    icon:      'ri-seedling-line',
  },
  {
    key:       'growth',
    name:      'Growth Pack',
    credits:   10_000,
    amountNgn: 45_000,
    badge:     'Most credits',
    icon:      'ri-rocket-line',
  },
]

/** Derive naira amount from credits_delta using the fixed package map. */
function deriveAmountNgn(creditsDelta: number): string {
  const pkg = PACKAGES.find(p => p.credits === creditsDelta)
  return pkg ? `₦${pkg.amountNgn.toLocaleString('en-NG')}` : '—'
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

/* ── Auto top-up modal ───────────────────────────────────────────────── */
function AutoTopupModal({
  current,
  onClose,
  onSave,
}: {
  current: number | null
  onClose: () => void
  onSave: (threshold: number | null) => void
}) {
  const [value, setValue] = useState(current !== null ? String(current) : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const threshold = value.trim() === '' ? null : parseInt(value, 10)
    try {
      const res = await api.post<Wallet>('/wallet/auto-topup', { threshold })
      onSave(res.data.auto_topup_threshold)
      onClose()
    } catch {
      alert('Failed to update auto top-up. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-[16px] text-neutral-900">Auto Top-Up</div>
            <div className="text-[12px] text-neutral-400 mt-0.5">
              Automatically buy the Starter Pack when your balance drops below this threshold
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-neutral-100 transition-colors">
            <RemixIcon name="ri-close-line" size={18} color="#71717a" />
          </button>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-neutral-800 mb-2">
            Threshold (credits) — leave blank to disable
          </label>
          <input
            type="number"
            min="0"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. 500"
            className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-[13px] outline-none focus:border-brand-400 transition-colors"
          />
          <p className="text-[11.5px] text-neutral-400 mt-1.5">
            When your balance falls below this number, the Starter Pack (5,000 credits) will be purchased automatically.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-neutral-200 text-[13px] font-bold text-neutral-800 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 py-2.5 rounded-full text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: '#c026d3' }}
          >
            {saving ? 'Saving…' : value.trim() === '' ? 'Disable' : 'Save threshold'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function AiCreditWallet() {
  const [wallet, setWallet]       = useState<Wallet | null>(null)
  const [buying, setBuying]       = useState<PkgKey | null>(null)
  const [showTopup, setShowTopup] = useState(false)
  const packagesRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.get<Wallet>('/wallet').then(res => setWallet(res.data))
  }, [])

  const balance   = wallet?.balance ?? 0
  const txs       = wallet?.transactions ?? []
  const usageTxs  = txs.filter(t => t.transaction_type === 'usage')
  const purchases = txs.filter(t => t.transaction_type === 'purchase' && t.status === 'paid')

  const scrollToPackages = () =>
    packagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const handleBuyCredits = async (pkg: PkgKey) => {
    if (buying) return
    setBuying(pkg)
    try {
      const res = await api.post<{ authorization_url: string }>('/wallet/initiate-purchase', { package: pkg })
      window.location.href = res.data.authorization_url
    } catch {
      alert('Payment initialisation failed. Please try again.')
      setBuying(null)
    }
  }

  return (
    <>
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-neutral-900">AI Credit Wallet</h1>
          <p className="text-neutral-500 mt-1 text-[13.5px]">
            No subscriptions — pay-as-you-go credits for AI-powered features
          </p>
        </div>
        <button
          onClick={scrollToPackages}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold text-[14px] transition-colors shrink-0 w-full sm:w-auto justify-center"
        >
          <RemixIcon name="ri-add-circle-line" size={17} color="#fff" />
          Buy Credits
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Current Balance"      value={balance.toLocaleString()}  sub="Available AI credits"    subColor="text-neutral-400" icon="ri-quill-pen-fill"   />
        <StatCard label="Used This Month"      value={String(usageTxs.reduce((s, t) => s + Math.abs(t.credits_delta), 0))} sub="Credits consumed" subColor="text-neutral-400" icon="ri-flashlight-fill" />
        <StatCard label="Purchased This Month" value={String(purchases.reduce((s, t) => s + t.credits_delta, 0))} sub="Via Paystack" subColor="text-neutral-400" icon="ri-handbag-fill" />
        <StatCard label="Auto Top-Up"          value={wallet?.auto_topup_threshold ? `At ${wallet.auto_topup_threshold}` : 'Off'} sub="Threshold" subColor="text-neutral-400" icon="ri-bar-chart-fill" />
      </div>

      {/* ── Balance card + recent usage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Balance card column */}
        <div className="flex flex-col justify-between gap-3">
          <div className="rounded-3xl p-4">
            <div
              className="rounded-2xl p-8 text-white flex flex-col gap-4 min-h-[250px] relative overflow-hidden"
              style={{ background: 'linear-gradient(90deg, #94C698 0%, #3D8043 100%)' }}
            >
              <img
                src="/card-back.png"
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none select-none"
              />

              <div className="relative flex items-start justify-between">
                <div className="text-[28px] font-extrabold leading-none tracking-tight">
                  {balance.toLocaleString()} credits
                </div>
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/20 shrink-0">Active</span>
              </div>

              <div className="relative flex items-end justify-between mt-auto">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-widest opacity-60">Auto Top-Up</span>
                  <span className="text-[13px] font-semibold">
                    {wallet?.auto_topup_threshold ? `At ${wallet.auto_topup_threshold} credits` : 'Disabled'}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] uppercase tracking-widest opacity-60">Last Purchase</span>
                  <span className="text-[13px] font-semibold">
                    {purchases[0] ? formatDate(purchases[0].created_at) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <img src="/logo.png" alt="FOID" className="h-9 w-auto object-contain" />
                  <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.4px', color: '#ffffff' }}>
                    FOID
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={scrollToPackages}
              className="flex-1 py-2.5 rounded-full text-[13px] font-bold border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors text-neutral-900"
            >
              Buy Credits
            </button>
            <button
              onClick={() => setShowTopup(true)}
              className="flex-1 py-2.5 rounded-full text-[13px] font-bold border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors text-neutral-900"
            >
              {wallet?.auto_topup_threshold ? 'Edit Auto Top-up' : 'Auto Top-up'}
            </button>
          </div>
        </div>

        {/* Recent usage table */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <div className="font-bold text-[15px] text-neutral-900 mb-4">Recent usage</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[380px]">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['DATE', 'FEATURE', 'CREDITS USED'].map(col => (
                    <th key={col} className="pb-3 text-[11px] font-bold text-neutral-400 uppercase tracking-widest whitespace-nowrap px-2 last:text-right">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usageTxs.slice(0, 6).map((row: WalletTransaction) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 transition-colors">
                    <td className="py-4 px-2 text-[13px] text-neutral-500 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="py-4 px-2 text-[13px] text-neutral-900">{row.feature}</td>
                    <td className="py-4 px-2 text-[13px] font-bold text-right text-neutral-900">{row.credits_delta}</td>
                  </tr>
                ))}
                {usageTxs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-[13px] text-neutral-400">No usage yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Credit packages ── */}
      <div ref={packagesRef} className="flex flex-col gap-4 scroll-mt-6">
        <div>
          <div className="text-[17px] font-bold text-neutral-900">Buy credits</div>
          <div className="text-[13px] text-neutral-400 mt-0.5">One-time purchases — no subscription, credits never expire</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PACKAGES.map(pkg => {
            const pricePerCredit = (pkg.amountNgn / pkg.credits).toFixed(1)
            const isBuying = buying === pkg.key
            const isHighlighted = pkg.badge !== null

            return (
              <div
                key={pkg.key}
                className="relative bg-white rounded-2xl p-6 flex flex-col gap-4 transition-shadow hover:shadow-md"
                style={{ border: `1.5px solid ${isHighlighted ? '#c026d3' : '#e5e7eb'}` }}
              >
                {/* Badge */}
                {pkg.badge && (
                  <span
                    className="absolute -top-3 left-5 px-3 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: '#c026d3', color: '#fff' }}
                  >
                    {pkg.badge}
                  </span>
                )}

                {/* Icon + name */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#fdf4ff' }}
                  >
                    <RemixIcon name={pkg.icon} size={20} color="#c026d3" />
                  </div>
                  <div className="font-bold text-[15px] text-neutral-900">{pkg.name}</div>
                </div>

                {/* Credits */}
                <div>
                  <div className="text-[28px] font-extrabold text-neutral-900 leading-none">
                    {pkg.credits.toLocaleString()}
                    <span className="text-[15px] font-semibold text-neutral-400 ml-1.5">credits</span>
                  </div>
                  <div className="text-[12.5px] text-neutral-400 mt-1">₦{pricePerCredit} per credit</div>
                </div>

                {/* Divider */}
                <div className="border-t border-neutral-100" />

                {/* Price + buy button */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[22px] font-extrabold text-neutral-900 leading-none">
                      ₦{pkg.amountNgn.toLocaleString('en-NG')}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">one-time · via Paystack</div>
                  </div>
                  <button
                    onClick={() => void handleBuyCredits(pkg.key)}
                    disabled={buying !== null}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 shrink-0"
                    style={{ background: '#c026d3' }}
                  >
                    {isBuying ? (
                      <>
                        <RemixIcon name="ri-loader-4-line" size={14} color="#fff" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <RemixIcon name="ri-secure-payment-line" size={14} color="#fff" />
                        Buy now
                      </>
                    )}
                  </button>
                </div>

                {/* Feature list */}
                <ul className="flex flex-col gap-1.5">
                  {[
                    `${Math.floor(pkg.credits / 4).toLocaleString()} receipt scans`,
                    `${pkg.credits.toLocaleString()} AI chat messages`,
                    'Credits never expire',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                      <RemixIcon name="ri-checkbox-circle-fill" size={14} color="#c026d3" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Purchase history ── */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          <div className="font-bold text-[15px] text-neutral-900">Purchase history</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-neutral-100">
                {['DATE', 'PACKAGE', 'CREDITS', 'AMOUNT', 'STATUS'].map(col => (
                  <th key={col} className="px-6 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((row: WalletTransaction) => (
                <tr key={row.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 transition-colors">
                  <td className="px-6 py-4 text-[13px] text-neutral-500 whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="px-6 py-4 text-[13px] font-semibold text-neutral-900">{row.feature}</td>
                  <td className="px-6 py-4 text-[13px] font-bold text-green-600">+{row.credits_delta.toLocaleString()}</td>
                  <td className="px-6 py-4 text-[13px] text-neutral-700">{deriveAmountNgn(row.credits_delta)}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                      {row.status ?? 'paid'}
                    </span>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[13px] text-neutral-400">No purchases yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>

    {showTopup && wallet && (
      <AutoTopupModal
        current={wallet.auto_topup_threshold}
        onClose={() => setShowTopup(false)}
        onSave={threshold => setWallet(prev => prev ? { ...prev, auto_topup_threshold: threshold } : prev)}
      />
    )}
    </>
  )
}
