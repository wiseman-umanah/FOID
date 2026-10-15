import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import MonoConnect from '@mono.co/connect.js'
import RemixIcon from '@/components/RemixIcon'
import StatCard from '@/components/StatCard'
import type { ConnectedBank } from '@/types/idra'
import { api } from '@/lib/api'

/* ── Transaction type ────────────────────────────────────────────────── */
interface BankTx {
  id: string
  amount: number
  type: string
  balance: number
  date: string
  narration: string
  category: string | null
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function lastSyncLabel(bank: ConnectedBank): string {
  if (!bank.last_synced_at) return 'never synced'
  const diff = Math.floor((Date.now() - new Date(bank.last_synced_at).getTime()) / 60_000)
  if (diff < 1) return 'synced just now'
  if (diff < 60) return `synced ${diff} min ago`
  return `synced ${Math.floor(diff / 60)}h ago`
}

function lastSyncColor(bank: ConnectedBank): string {
  return bank.status === 'error' ? '#ef4444' : '#a1a1aa'
}

/* ── Bank avatar ────────────────────────────────────────────────────── */
function BankAvatar({ bank }: { bank: ConnectedBank }) {
  if (bank.logo_url) {
    return (
      <img
        src={bank.logo_url}
        alt={bank.name}
        className="w-10 h-10 rounded-full object-cover border border-neutral-100 shrink-0"
      />
    )
  }
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-[15px] font-bold bg-blue-600"
    >
      {bank.name[0]}
    </div>
  )
}

/* ── Verified badge ─────────────────────────────────────────────────── */
function VerifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap"
      style={{ background: '#fae8ff', color: '#c026d3' }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#c026d3" />
        <path d="M7 12.5l3.5 3.5 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified
    </span>
  )
}

/* ── Transactions drawer ─────────────────────────────────────────────── */
function TransactionsDrawer({ bank, onClose }: { bank: ConnectedBank; onClose: () => void }) {
  const [txs, setTxs]       = useState<BankTx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get<BankTx[]>(`/banks/${bank.id}/transactions?limit=50`)
      .then(res => setTxs(res.data))
      .catch(() => setError('Could not load transactions — Mono sandbox may require a linked test account.'))
      .finally(() => setLoading(false))
  }, [bank.id])

  const naira = (n: number) => '₦' + Math.abs(n).toLocaleString('en-NG')

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div
        className="relative bg-white h-full w-full max-w-[480px] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 shrink-0">
          <div>
            <div className="font-bold text-[16px] text-neutral-900">{bank.name}</div>
            <div className="text-[12px] text-neutral-400 mt-0.5">
              {bank.masked_number ? `···· ${bank.masked_number.slice(-4)}` : 'Transaction history'}
              {bank.account_type ? ` · ${bank.account_type}` : ''}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-neutral-100 transition-colors">
            <RemixIcon name="ri-close-line" size={18} color="#71717a" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-40 text-[13px] text-neutral-400">Loading…</div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 px-6 text-center">
              <RemixIcon name="ri-wifi-off-line" size={32} color="#d4d4d8" />
              <p className="text-[13px] text-neutral-400">{error}</p>
            </div>
          )}
          {!loading && !error && txs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <RemixIcon name="ri-inbox-line" size={32} color="#d4d4d8" />
              <p className="text-[13px] text-neutral-400">No transactions found</p>
            </div>
          )}
          {!loading && !error && txs.length > 0 && (
            <div className="divide-y divide-neutral-100">
              {txs.map(tx => {
                const isCredit = tx.type === 'credit'
                return (
                  <div key={tx.id} className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: isCredit ? '#dcfce7' : '#fee2e2' }}
                    >
                      <RemixIcon
                        name={isCredit ? 'ri-arrow-left-down-line' : 'ri-arrow-right-up-line'}
                        size={16}
                        color={isCredit ? '#16a34a' : '#dc2626'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-neutral-900 truncate">{tx.narration}</div>
                      <div className="text-[11.5px] text-neutral-400 mt-0.5">
                        {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {tx.category ? ` · ${tx.category}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-[14px] font-bold"
                        style={{ color: isCredit ? '#16a34a' : '#dc2626' }}
                      >
                        {isCredit ? '+' : '-'}{naira(tx.amount)}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">Bal: {naira(tx.balance)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Add-bank modal — uses @mono.co/connect.js SDK ─────────────────── */
function AddBankModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [linking, setLinking] = useState(false)
  const monoRef = useRef<MonoConnect | null>(null)

  // Keep latest callbacks in refs so the Mono instance never goes stale
  const onConnectedRef = useRef(onConnected)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onConnectedRef.current = onConnected }, [onConnected])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Initialise once after the modal mounts so the SDK can inject its iframe.
  // The cleanup tears down the widget div so React strict-mode double-invoke
  // doesn't leave a stale iframe behind.
  useEffect(() => {
    const instance = new MonoConnect({
      key: import.meta.env.VITE_MONO_PUBLIC_KEY as string,
      onClose: () => setLinking(false),
      onLoad: () => { /* ready */ },
      onSuccess: async ({ code }: { code: string }) => {
        setLinking(true)
        try {
          await api.post('/banks/exchange-token', { code })
          onConnectedRef.current()
          onCloseRef.current()
        } catch {
          alert('Failed to link bank account. Please try again.')
          setLinking(false)
        }
      },
    })
    instance.setup()
    monoRef.current = instance

    return () => {
      // Remove the widget div the SDK injected so a re-mount starts clean
      document.getElementById('mono-connect--widget-div')?.remove()
      monoRef.current = null
    }
  }, [])

  const handleOpen = useCallback(() => {
    monoRef.current?.open()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[440px] p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-neutral-900">Connect a bank account</h2>
            <p className="text-[12.5px] text-neutral-400 mt-0.5">
              Read-only Open Banking access via Mono sandbox
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors shrink-0"
          >
            <RemixIcon name="ri-close-line" size={18} color="#71717a" clickable />
          </button>
        </div>

        <button
          onClick={handleOpen}
          disabled={linking}
          className="w-full py-3 rounded-xl font-bold text-white text-[14px] transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(90deg, #c026d3 0%, #701a75 100%)' }}
        >
          {linking ? 'Linking…' : 'Open Mono Connect'}
        </button>

        <div className="flex items-start gap-2 bg-neutral-50 rounded-xl px-4 py-3">
          <RemixIcon name="ri-shield-check-line" size={15} color="#a1a1aa" className="mt-0.5 shrink-0" />
          <p className="text-[11.5px] text-neutral-500 leading-relaxed">
            FOID only reads transaction data. We never store credentials or move funds.
            Connection uses the CBN-licensed Open Banking sandbox.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════ */
export default function ConnectedBankPage() {
  const [banks, setBanks] = useState<ConnectedBank[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedBank, setSelectedBank] = useState<ConnectedBank | null>(null)
  const [combinedBalance, setCombinedBalance] = useState<number | null>(null)

  const fetchBanks = useCallback(async () => {
    try {
      const res = await api.get<ConnectedBank[]>('/banks/connected')
      setBanks(res.data)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchBanks() }, [fetchBanks])

  // Fetch combined balance whenever the banks list changes (and is non-empty)
  useEffect(() => {
    if (banks.length === 0) { setCombinedBalance(null); return }
    void api.get<{ total_balance: number }>('/banks/combined-balance')
      .then(r => setCombinedBalance(r.data.total_balance))
      .catch(() => setCombinedBalance(null))
  }, [banks.length])

  const handleDisconnect = async (id: string) => {
    try {
      await api.delete(`/banks/${id}`)
      setBanks(prev => prev.filter(b => b.id !== id))
    } catch {
      alert('Failed to disconnect bank. Please try again.')
    }
  }

  const handleSync = async (id: string) => {
    try {
      const res = await api.post<ConnectedBank>(`/banks/${id}/sync`)
      setBanks(prev => prev.map(b => b.id === id ? res.data : b))
    } catch {
      alert('Sync failed. Please try again.')
    }
  }

  const connected = banks.length
  const errorCount = banks.filter(b => b.status === 'error').length

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-neutral-900">Connected Bank Accounts</h1>
          <p className="text-neutral-500 mt-1 text-[13.5px]">
            Manage the banks and fintechs linked to your FOID identity via Open Banking
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-[14px] text-white transition-opacity hover:opacity-90 shrink-0 self-start"
          style={{ background: '#c026d3' }}
        >
          <RemixIcon name="ri-add-line" size={18} color="#fff" clickable />
          Connect Bank
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Connected Banks"
          value={String(connected)}
          sub="Open Banking linked accounts"
          subColor="text-brand-500 font-semibold"
          icon="ri-bank-line"
        />
        <StatCard
          label="Combined Balance"
          value={combinedBalance !== null ? '₦' + combinedBalance.toLocaleString('en-NG') : '₦—'}
          sub="Across all linked accounts"
          subColor="text-neutral-400"
          icon="ri-coin-line"
        />
        <StatCard
          label="Last Synced"
          value={banks.length ? lastSyncLabel(banks[0]) : '—'}
          sub="Auto-sync every 15 min"
          subColor="text-neutral-400"
          icon="ri-refresh-line"
        />
        <StatCard
          label="Needs Attention"
          value={String(errorCount)}
          sub={errorCount > 0 ? 'Reconnect required' : 'All connections healthy'}
          subColor={errorCount > 0 ? 'text-red-500 font-semibold' : 'text-neutral-400'}
          icon="ri-alarm-warning-fill"
        />
      </div>

      {/* ── Linked institutions table ── */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <span className="text-[15px] font-bold text-neutral-900">Your linked institutions</span>
          <span className="text-[12px] text-neutral-400 hidden sm:block">
            Data is shared read-only and only with your consent
          </span>
        </div>

        <div className="divide-y divide-neutral-100">
          {loading && (
            <div className="px-6 py-10 text-center text-[13px] text-neutral-400">Loading…</div>
          )}
          {!loading && banks.length === 0 && (
            <div className="px-6 py-12 text-center text-neutral-400 text-[13px]">
              No connected banks. Click "+ Connect Bank" to link your first account.
            </div>
          )}
          {banks.map(bank => (
            <div
              key={bank.id}
              className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50/60 transition-colors cursor-pointer"
              onClick={() => setSelectedBank(bank)}
            >
              {/* Left: logo + name + account info */}
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <BankAvatar bank={bank} />
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-neutral-900 leading-tight">{bank.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {bank.masked_number && (
                      <span className="text-[12px] text-neutral-400 font-mono">{bank.masked_number}</span>
                    )}
                    {bank.account_type && (
                      <>
                        <span className="text-neutral-300 text-[11px]">·</span>
                        <span className="text-[12px] text-neutral-400">{bank.account_type}</span>
                      </>
                    )}
                    <span className="text-neutral-300 text-[11px]">·</span>
                    <span className="text-[12px]" style={{ color: lastSyncColor(bank) }}>
                      {lastSyncLabel(bank)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: badge + buttons */}
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {bank.status === 'error' ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                    style={{ background: '#fee2e2', color: '#dc2626' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    Error
                  </span>
                ) : (
                  <VerifiedBadge />
                )}

                <button
                  onClick={e => { e.stopPropagation(); void handleSync(bank.id) }}
                  className="px-4 py-1.5 rounded-full border border-neutral-200 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors whitespace-nowrap"
                >
                  Sync
                </button>
                <button
                  onClick={e => { e.stopPropagation(); void handleDisconnect(bank.id) }}
                  className="px-4 py-1.5 rounded-full border border-neutral-200 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors whitespace-nowrap"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <AddBankModal
          onClose={() => setShowAddModal(false)}
          onConnected={fetchBanks}
        />
      )}

      {selectedBank && (
        <TransactionsDrawer
          bank={selectedBank}
          onClose={() => setSelectedBank(null)}
        />
      )}
    </div>
  )
}
