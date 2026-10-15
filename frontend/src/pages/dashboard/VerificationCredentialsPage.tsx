import { useState, useEffect, useCallback } from 'react'
import RemixIcon from '@/components/RemixIcon'
import StatCard from '@/components/StatCard'
import SegmentedTabs from '@/components/SegmentedTabs'
import { useCredential } from '@/contexts/CredentialContext'
import { api } from '@/lib/api'
import type { ConsentItem, CredentialState } from '@/types/idra'

/* ── Status mapping ─────────────────────────────────────────────────── */
// Consent statuses map to display statuses for the table
type DisplayStatus = 'active' | 'pending' | 'revoked'

function toDisplayStatus(status: ConsentItem['status']): DisplayStatus {
  if (status === 'approved') return 'active'
  if (status === 'revoked')  return 'revoked'
  return 'pending'
}

const STATUS_META: Record<DisplayStatus, { label: string; bg: string; color: string }> = {
  active:  { label: 'Active',  bg: '#fae8ff', color: '#a21caf' },
  pending: { label: 'Pending', bg: '#fef9c3', color: '#a16207' },
  revoked: { label: 'Revoked', bg: '#fee2e2', color: '#dc2626' },
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function shortId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-5)}` : id
}

/* ── Status badge ───────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: DisplayStatus }) {
  const m = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap"
      style={{ background: m.bg, color: m.color }}
    >
      {m.label}
    </span>
  )
}

/* ── Logo avatar ────────────────────────────────────────────────────── */
function PlatformLogo({ name, logo_url }: { name: string; logo_url: string | null }) {
  if (logo_url) {
    return (
      <img
        src={logo_url}
        alt={name}
        className="w-9 h-9 rounded-lg object-contain shrink-0 border border-neutral-100 bg-white p-0.5"
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 text-brand-600 text-[14px] font-bold">
      {name.charAt(0)}
    </div>
  )
}

/* ── Filter tabs ────────────────────────────────────────────────────── */
type Filter = 'all' | 'active' | 'pending' | 'revoked'

const TABS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All'     },
  { key: 'active',  label: 'Active'  },
  { key: 'pending', label: 'Pending' },
  { key: 'revoked', label: 'Revoked' },
]

/* ── FOID state alert labels ────────────────────────────────────────── */
const FOID_STATE_LABELS: Record<CredentialState, string> = {
  active:       'Active',
  under_review: 'Under Review',
  downgraded:   'Downgraded',
  revoked:      'Revoked',
}

/* ════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════ */
export default function VerificationCredentialsPage() {
  const { credential } = useCredential()

  const [consents, setConsents]   = useState<ConsentItem[]>([])
  const [filter, setFilter]       = useState<Filter>('all')
  const [search, setSearch]       = useState('')
  const [revoking, setRevoking]   = useState<string | null>(null)  // id being revoked

  useEffect(() => {
    void api.get<ConsentItem[]>('/consents')
      .then(r => setConsents(r.data))
      .catch(() => {})
  }, [])

  /* ── Revoke a consent ─────────────────────────────────────────────── */
  const revoke = useCallback(async (id: string) => {
    setRevoking(id)
    try {
      await api.patch(`/consents/${id}`, { status: 'revoked' })
      setConsents(prev => prev.map(c => c.id === id ? { ...c, status: 'revoked' } : c))
    } catch {
      // silently ignore — row stays as-is
    } finally {
      setRevoking(null)
    }
  }, [])

  /* ── Derived counts for stat cards ───────────────────────────────── */
  const activeCount   = consents.filter(c => c.status === 'approved').length
  const pendingCount  = consents.filter(c => c.status === 'pending').length
  const revokedCount  = consents.filter(c => c.status === 'revoked').length
  const expiringSoon  = consents.filter(c =>
    c.status === 'approved' && c.expires_at && daysUntil(c.expires_at) <= 30
  ).length

  /* ── Filtered + searched rows ────────────────────────────────────── */
  const visible = consents.filter(c => {
    const ds = toDisplayStatus(c.status)
    if (filter !== 'all' && ds !== filter) return false
    if (search && !c.platform.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  /* ── Master credential row (always pinned first) ─────────────────── */
  const masterDs: DisplayStatus =
    credential.state === 'active' ? 'active' :
    credential.state === 'revoked' ? 'revoked' : 'pending'

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-neutral-900">Verification Credentials</h1>
          <p className="text-neutral-500 mt-1 text-[13.5px]">Every credential generated from your FOID identity, and where it's been shared</p>
        </div>
      </div>

      {/* ── Live FOID credential state banner ── */}
      {credential.state !== 'active' && (
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-xl border text-[13px] font-semibold"
          style={{
            background:   credential.state === 'revoked' ? '#fee2e2' : '#fef9c3',
            borderColor:  credential.state === 'revoked' ? '#fca5a5' : '#fde68a',
            color:        credential.state === 'revoked' ? '#dc2626' : '#a16207',
          }}
        >
          <RemixIcon name="ri-alert-fill" size={16} color={credential.state === 'revoked' ? '#dc2626' : '#a16207'} />
          <span>
            Your FOID master credential is currently <strong>{FOID_STATE_LABELS[credential.state]}</strong>.
            {credential.state === 'under_review' && ' Relying parties may see reduced access until review is complete.'}
            {credential.state === 'downgraded' && ' Some claims have been downgraded — new credential requests may be limited.'}
            {credential.state === 'revoked' && ' All credential sharing has been halted. Contact support or re-verify your identity.'}
          </span>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Credentials"
          value={String(activeCount)}
          sub={activeCount === 1 ? 'Shared with 1 platform' : `Shared across ${activeCount} platforms`}
          subColor="text-neutral-400"
          icon="ri-file-text-fill"
        />
        <StatCard
          label="Pending"
          value={String(pendingCount)}
          sub={pendingCount === 0 ? 'No pending requests' : `Awaiting your decision`}
          subColor={pendingCount > 0 ? 'text-amber-600 font-semibold' : 'text-neutral-400'}
          icon="ri-user-shared-2-fill"
        />
        <StatCard
          label="Expiring Soon"
          value={String(expiringSoon)}
          sub={expiringSoon > 0 ? 'Renew within 30 days' : 'None expiring soon'}
          subColor={expiringSoon > 0 ? 'text-green-600 font-semibold' : 'text-neutral-400'}
          icon="ri-alarm-warning-fill"
        />
        <StatCard
          label="Revoked"
          value={String(revokedCount)}
          sub="Access removed"
          subColor="text-neutral-400"
          icon="ri-close-circle-fill"
        />
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 py-4">
          <div className="overflow-x-auto w-full sm:w-auto">
            <SegmentedTabs value={filter} onChange={setFilter} tabs={TABS} />
          </div>
          <div className="sm:ml-auto relative w-full sm:w-[280px]">
            <RemixIcon
              name="ri-search-line"
              size={16}
              color="#a1a1aa"
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by platform"
              className="pl-8 pr-4 py-2 w-full rounded-full border border-neutral-200 bg-neutral-50 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-brand-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[16px] border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-neutral-200">
                {['CREDENTIAL ID', 'SHARED WITH', 'SCOPE', 'ISSUED', 'EXPIRES', 'STATUS', 'ACTIONS'].map((col, i, arr) => (
                  <th
                    key={col}
                    className={[
                      'px-6 py-4 text-[16px] font-semibold text-black uppercase tracking-widest whitespace-nowrap',
                      i === 0              ? 'rounded-tl-xl' : '',
                      i === arr.length - 1 ? 'rounded-tr-xl' : '',
                    ].join(' ')}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>

              {/* ── FOID Master Credential row — always pinned when filter allows ── */}
              {(filter === 'all' || filter === masterDs) && (
                <tr className="border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors">
                  <td className="px-6 py-5 text-black font-mono text-[13px]">{shortId(credential.id || 'idra-master')}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
                        <RemixIcon name="ri-shield-user-fill" size={18} color="#fff" />
                      </div>
                      <span className="font-semibold text-neutral-900 whitespace-nowrap">FOID Master Credential</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-neutral-600 text-[13px] max-w-[200px]">
                    identity · bvn · age · income band · account stability
                  </td>
                  <td className="px-6 py-5 text-neutral-500 whitespace-nowrap text-[13px]">
                    {fmtDate(credential.issued_at)}
                  </td>
                  <td className="px-6 py-5 text-neutral-500 whitespace-nowrap text-[13px]">—</td>
                  <td className="px-6 py-5"><StatusBadge status={masterDs} /></td>
                  <td className="px-6 py-5">
                    <button
                      disabled
                      className="px-4 py-1.5 rounded-full border border-neutral-200 text-[12px] font-semibold text-neutral-400 cursor-not-allowed opacity-40"
                    >
                      System
                    </button>
                  </td>
                </tr>
              )}

              {/* ── Real consent rows ── */}
              {visible.map(consent => {
                const ds = toDisplayStatus(consent.status)
                const isRevoking = revoking === consent.id
                const canRevoke  = consent.status !== 'revoked'
                return (
                  <tr key={consent.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 transition-colors">
                    <td className="px-6 py-5 text-black font-mono text-[13px]">{shortId(consent.id)}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <PlatformLogo name={consent.platform} logo_url={consent.logo_url} />
                        <span className="font-semibold text-neutral-900 whitespace-nowrap">{consent.platform}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-neutral-600 text-[13px] max-w-[200px]">{consent.scope}</td>
                    <td className="px-6 py-5 text-neutral-500 whitespace-nowrap text-[13px]">
                      {fmtDate(consent.requested_at)}
                    </td>
                    <td className="px-6 py-5 text-neutral-500 whitespace-nowrap text-[13px]">
                      {consent.expires_at ? fmtDate(consent.expires_at) : '—'}
                    </td>
                    <td className="px-6 py-5"><StatusBadge status={ds} /></td>
                    <td className="px-6 py-5">
                      <button
                        disabled={!canRevoke || isRevoking}
                        onClick={() => canRevoke && void revoke(consent.id)}
                        className="px-4 py-1.5 rounded-full border border-neutral-200 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRevoking ? '…' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                )
              })}

              {/* ── Empty state ── */}
              {visible.length === 0 && !(filter === 'all' || filter === masterDs) && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-400">
                    No credentials match your filter.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
