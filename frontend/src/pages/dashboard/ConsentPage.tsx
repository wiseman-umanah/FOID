import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import RemixIcon from '@/components/RemixIcon'
import StatCard from '@/components/StatCard'
import SegmentedTabs from '@/components/SegmentedTabs'
import type { ConsentItem } from '@/types/idra'
import { api } from '@/lib/api'

/* ── Types ──────────────────────────────────────────────────────────── */
type ConsentStatus = 'pending' | 'approved' | 'revoked'

/* ── Helpers ────────────────────────────────────────────────────────── */
function requestedLabel(requested_at: string): string {
  const diff = Math.floor((Date.now() - new Date(requested_at).getTime()) / 60_000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff} min ago`
  if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`
  return new Date(requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function expiresLabel(expires_at: string | null): string {
  if (!expires_at) return '—'
  return new Date(expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Status badge ───────────────────────────────────────────────────── */
const STATUS_META: Record<ConsentStatus, { label: string; bg: string; color: string; border?: string }> = {
  pending:  { label: 'Pending',  bg: 'transparent', color: '#71717a', border: '1px solid #d4d4d8' },
  approved: { label: 'Approved', bg: '#fae8ff',      color: '#a21caf' },
  revoked:  { label: 'Revoked',  bg: '#fee2e2',      color: '#dc2626' },
}

function StatusBadge({ status }: { status: ConsentStatus }) {
  const m = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap"
      style={{ background: m.bg, color: m.color, border: m.border }}
    >
      {m.label}
    </span>
  )
}

/* ── Action buttons ─────────────────────────────────────────────────── */
function ActionButtons({
  consent,
  onUpdate,
}: {
  consent: ConsentItem
  onUpdate: (id: string, status: 'approved' | 'revoked') => void
}) {
  if (consent.status === 'pending') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdate(consent.id, 'approved')}
          className="px-4 py-1.5 rounded-full text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#c026d3' }}
        >
          Approve
        </button>
        <button
          onClick={() => onUpdate(consent.id, 'revoked')}
          className="px-4 py-1.5 rounded-full border border-neutral-200 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Deny
        </button>
      </div>
    )
  }
  if (consent.status === 'approved') {
    return (
      <button
        onClick={() => onUpdate(consent.id, 'revoked')}
        className="px-4 py-1.5 rounded-full border border-neutral-200 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors whitespace-nowrap"
      >
        Revoke access
      </button>
    )
  }
  return (
    <button className="px-4 py-1.5 rounded-full border border-neutral-200 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors">
      View
    </button>
  )
}

/* ── Consent Policy Modal ───────────────────────────────────────────── */
function ConsentPolicyModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[640px] max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
              <RemixIcon name="ri-newspaper-line" size={18} color="#c026d3" />
            </div>
            <div>
              <div className="text-[15px] font-bold text-neutral-900">FOID Consent Policy</div>
              <div className="text-[12px] text-neutral-400">Effective 21 September 2025 · Version 1.0</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
          >
            <RemixIcon name="ri-close-line" size={18} color="#71717a" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5 text-[13.5px] text-neutral-700 leading-relaxed">

          <section>
            <h2 className="text-[14px] font-bold text-neutral-900 mb-2">1. What is a Consent Request?</h2>
            <p>
              A consent request is a formal permission request from a financial institution, lender, or
              merchant ("Relying Party") to access specific claims from your FOID digital identity credential.
              No data is shared until you explicitly approve the request. You may deny or revoke access at
              any time.
            </p>
          </section>

          <section>
            <h2 className="text-[14px] font-bold text-neutral-900 mb-2">2. What Data Can Be Requested?</h2>
            <p className="mb-2">Relying Parties may request access to one or more of the following claim types:</p>
            <ul className="flex flex-col gap-1.5 pl-4">
              {[
                ['Identity verification', 'Confirms your NIN has been validated against NIMC records'],
                ['BVN validation', 'Confirms your Bank Verification Number is active and linked to your profile'],
                ['Age verification', 'Confirms you are 18 years of age or older — no exact date disclosed'],
                ['Income band', 'Indicates your income range as low, mid, or high — no exact figures'],
                ['Account stability', 'Reflects the consistency of activity in your linked bank accounts'],
                ['Repayment reliability', 'Reflects your historical repayment behaviour from Open Banking data'],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                  <span><strong className="text-neutral-900">{title}</strong> — {desc}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-[14px] font-bold text-neutral-900 mb-2">3. Your Rights</h2>
            <ul className="flex flex-col gap-1.5 pl-4">
              {[
                'You may approve or deny any consent request at your discretion.',
                'Approval is always explicit — no data is ever shared without your action.',
                'You may revoke an approved consent at any time from this page or the Verification Credentials page.',
                'Revoking access does not delete historical data already processed by the Relying Party prior to revocation.',
                'You may request a full export of your consent history by contacting FOID support.',
              ].map(right => (
                <li key={right} className="flex gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                  <span>{right}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-[14px] font-bold text-neutral-900 mb-2">4. Data Minimisation</h2>
            <p>
              FOID only discloses the specific claims approved by you. We never transmit raw personal
              identifiers (e.g. full NIN, date of birth, account numbers) to Relying Parties. All
              disclosures are cryptographically signed claims — verifiable without requiring direct
              database access to FOID systems.
            </p>
          </section>

          <section>
            <h2 className="text-[14px] font-bold text-neutral-900 mb-2">5. Consent Expiry</h2>
            <p>
              Consent approvals may carry an optional expiry date set by the Relying Party at the time of
              the request. Once expired, access is automatically suspended and you will be notified.
              Consents with no expiry date remain active until you manually revoke them.
            </p>
          </section>

          <section>
            <h2 className="text-[14px] font-bold text-neutral-900 mb-2">6. Regulatory Basis</h2>
            <p>
              FOID operates under the Nigeria Data Protection Act 2023 (NDPA) and CBN Open Banking
              Framework guidelines. Consent records are immutably logged and available to you on request.
              Relying Parties must be registered institutions with a valid API key issued by FOID.
            </p>
          </section>

          <section>
            <h2 className="text-[14px] font-bold text-neutral-900 mb-2">7. Contact</h2>
            <p>
              For questions about this policy or to report a suspected misuse of your data, contact
              FOID support at <span className="text-brand-600 font-semibold">privacy@foid.ng</span>.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-brand-500 text-white text-[13.5px] font-semibold hover:bg-brand-600 transition-colors"
          >
            Got it
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}

/* ── Filter tabs ────────────────────────────────────────────────────── */
type Filter = 'all' | 'pending' | 'approved' | 'revoked'

const TABS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'revoked',  label: 'Revoked'  },
]

/* ── Page ───────────────────────────────────────────────────────────── */
export default function ConsentPage() {
  const [filter, setFilter]     = useState<Filter>('all')
  const [search, setSearch]     = useState('')
  const [consents, setConsents] = useState<ConsentItem[]>([])
  const [policyOpen, setPolicyOpen] = useState(false)

  useEffect(() => {
    void api.get<ConsentItem[]>('/consents').then(res => setConsents(res.data))
  }, [])

  const handleUpdate = useCallback(async (id: string, status: 'approved' | 'revoked') => {
    try {
      const res = await api.patch<ConsentItem>(`/consents/${id}`, { status })
      setConsents(prev => prev.map(c => c.id === id ? res.data : c))
    } catch {
      alert('Failed to update consent. Please try again.')
    }
  }, [])

  const visible = consents.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    if (search && !c.platform.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendingCount  = consents.filter(c => c.status === 'pending').length
  const approvedCount = consents.filter(c => c.status === 'approved').length
  const revokedCount  = consents.filter(c => c.status === 'revoked').length

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-neutral-900">Consent Requests</h1>
          <p className="text-neutral-500 mt-1 text-[13.5px]">Manage which apps and platforms can access your FOID identity data</p>
        </div>
        <button
          onClick={() => setPolicyOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 border border-neutral-200 rounded-full font-semibold text-[14px] text-neutral-800 bg-white hover:bg-neutral-50 transition-colors shrink-0 self-start"
        >
          <RemixIcon name="ri-newspaper-line" size={20} /> Consent Policy
        </button>
        {policyOpen && <ConsentPolicyModal onClose={() => setPolicyOpen(false)} />}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Requests"  value={String(pendingCount)}  sub="Awaiting your approval"  subColor="text-neutral-400" icon="ri-alert-fill"           />
        <StatCard label="Approved"          value={String(approvedCount)} sub="Banks, loans & merchants" subColor="text-neutral-400" icon="ri-checkbox-circle-fill" />
        <StatCard label="Denied / Revoked"  value={String(revokedCount)}  sub="Access blocked"           subColor="text-neutral-400" icon="ri-close-circle-fill"    />
        <StatCard label="Active Agreements" value={String(approvedCount)} sub="With active access"       subColor="text-neutral-400" icon="ri-book-2-fill"          />
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 py-4">
          <div className="overflow-x-auto w-full sm:w-auto">
            <SegmentedTabs value={filter} onChange={setFilter} tabs={TABS} />
          </div>

          {/* Search */}
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

        {/* Table — horizontally scrollable on mobile */}
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-neutral-200">
              {['SHARED WITH', 'SCOPE', 'REQUESTED', 'EXPIRES', 'STATUS', 'ACTIONS'].map((col, i, arr) => (
                <th
                  key={col}
                  className={[
                    'px-6 py-4 text-[13px] font-semibold text-neutral-600 uppercase tracking-widest whitespace-nowrap',
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
            {visible.map(consent => (
              <tr key={consent.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 transition-colors">
                {/* Shared with */}
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    {consent.logo_url ? (
                      <img
                        src={consent.logo_url}
                        alt={consent.platform}
                        className="w-9 h-9 rounded-lg object-contain shrink-0 border border-neutral-100 bg-white p-0.5"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-neutral-200 flex items-center justify-center shrink-0 text-[13px] font-bold text-neutral-600">
                        {consent.platform[0]}
                      </div>
                    )}
                    <span className="text-[14px] font-semibold text-neutral-900 whitespace-nowrap">{consent.platform}</span>
                  </div>
                </td>

                {/* Scope */}
                <td className="px-6 py-5 text-[13px] text-neutral-600 max-w-[180px] leading-snug">{consent.scope}</td>

                {/* Requested */}
                <td className="px-6 py-5 text-[13px] text-neutral-500 whitespace-nowrap">{requestedLabel(consent.requested_at)}</td>

                {/* Expires */}
                <td className="px-6 py-5 text-[13px] text-neutral-500 whitespace-nowrap">{expiresLabel(consent.expires_at)}</td>

                {/* Status */}
                <td className="px-6 py-5"><StatusBadge status={consent.status} /></td>

                {/* Actions */}
                <td className="px-6 py-5"><ActionButtons consent={consent} onUpdate={handleUpdate} /></td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[13px] text-neutral-400">
                  No consents match your filter.
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
