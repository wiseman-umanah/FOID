import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import RemixIcon from '@/components/RemixIcon'
import StatCard from '@/components/StatCard'
import IncomeExpenseChart from '@/components/IncomeExpenseChart'
import { useCredential } from '@/contexts/CredentialContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import type { CredentialState, ConnectedBank, ConsentItem, LedgerEntry, Wallet } from '@/types/idra'

/* ── Brand colours ──────────────────────────────────────────────────── */
const BRAND_LITE = '#f5d0fe'   // brand-200
const BRAND_DEEP = '#15803d'   // brand-600

/* ── Helpers ────────────────────────────────────────────────────────── */
const naira = (n: number) => '₦' + n.toLocaleString('en-NG')

function currentMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end) }
}

/** Group ledger entries into weekly buckets (by ISO week day-of-month bands) */
function toWeeklyChart(entries: LedgerEntry[]): { week: string; income: number; expense: number }[] {
  const buckets: Record<string, { income: number; expense: number }> = {}
  for (const e of entries) {
    const day = new Date(e.entry_date).getDate()
    const weekNum = Math.ceil(day / 7)
    const label = `Week ${weekNum}`
    if (!buckets[label]) buckets[label] = { income: 0, expense: 0 }
    const amt = parseFloat(e.amount)
    if (e.entry_type === 'income') buckets[label].income += amt
    else buckets[label].expense += amt
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, income: Math.round(v.income), expense: Math.round(v.expense) }))
}

/** Aggregate category totals from ledger entries */
function toCategoryBreakdown(entries: LedgerEntry[]): { label: string; pct: number; color: string }[] {
  const CAT_COLORS: Record<string, string> = {
    Payroll:   '#c026d3',
    Logistics: '#1e9e4a',
    Sales:     '#22c55e',
    Software:  '#7c3aed',
    Marketing: '#f59e0b',
    Utilities: '#0ea5e9',
    Other:     '#f5941c',
  }
  const totals: Record<string, number> = {}
  for (const e of entries) {
    if (e.entry_type !== 'expense') continue
    totals[e.category] = (totals[e.category] ?? 0) + parseFloat(e.amount)
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0)
  if (grand === 0) return []
  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([label, amt]) => ({
      label,
      pct: Math.round((amt / grand) * 100),
      color: CAT_COLORS[label] ?? '#a1a1aa',
    }))
}

/** Build credential-usage chart data from approved consents */
function toUsageData(consents: ConsentItem[]): { platform: string; pulls: number; remainder: number }[] {
  const CRED_MAX = 80
  const approved = consents.filter(c => c.status === 'approved')
  if (approved.length === 0) return []
  return approved.map(c => ({
    platform: c.platform,
    pulls: 1,                          // no pull-count in schema yet — show presence
    remainder: CRED_MAX - 1,
  }))
}

/* ── State badge colours ────────────────────────────────────────────── */
const STATE_META: Record<CredentialState, { label: string; color: string; bg: string }> = {
  active:       { label: 'Active',       color: '#a21caf', bg: '#fae8ff' },
  under_review: { label: 'Under Review', color: '#a16207', bg: '#fef9c3' },
  downgraded:   { label: 'Downgraded',   color: '#c2410c', bg: '#fff7ed' },
  revoked:      { label: 'Revoked',      color: '#dc2626', bg: '#fee2e2' },
}

/* ── Spending donut ─────────────────────────────────────────────────── */
function SpendingDonut({ segments }: { segments: { color: string; pct: number }[] }) {
  const SIZE = 200
  const cx   = SIZE / 2
  const cy   = SIZE / 2
  const r    = 72
  const SW   = 16
  const GAP  = 12
  const circ = 2 * Math.PI * r

  const START_DEG = -160
  let cursor = START_DEG
  const built = segments.map(s => {
    const spanDeg = (s.pct / 100) * 360 - GAP
    const midDeg  = cursor + GAP / 2 + spanDeg / 2
    const entry   = { ...s, startDeg: cursor + GAP / 2, spanDeg, midDeg }
    cursor += (s.pct / 100) * 360
    return entry
  })

  const toArc = (spanDeg: number) => {
    const fraction = spanDeg / 360
    const dash = fraction * circ
    const gap  = circ - dash
    return `${dash} ${gap}`
  }

  const badgePos = (midDeg: number) => {
    const rad = (midDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ececec" strokeWidth={SW} />
        {built.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={toArc(s.spanDeg)}
            transform={`rotate(${s.startDeg} ${cx} ${cy})`}
          />
        ))}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: 48, fontWeight: 800, color: '#c9c9c9', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        ₦
      </div>

      {built.map((s, i) => {
        const pos = badgePos(s.midDeg)
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center rounded-full text-white font-bold"
            style={{
              width: 28, height: 28,
              background: s.color,
              fontSize: 11,
              left: pos.x,
              top:  pos.y,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 2px 5px rgba(0,0,0,0.18)',
            }}
          >
            {s.pct}
          </div>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════ */
export default function OverviewPage() {
  const { credential } = useCredential()
  const { user } = useAuth()
  const stateMeta = STATE_META[credential.state]

  /* ── Remote data ──────────────────────────────────────────────────── */
  const [banks, setBanks]       = useState<ConnectedBank[]>([])
  const [wallet, setWallet]     = useState<Wallet | null>(null)
  const [consents, setConsents] = useState<ConsentItem[]>([])
  const [ledger, setLedger]     = useState<LedgerEntry[]>([])

  useEffect(() => {
    void api.get<ConnectedBank[]>('/banks/connected').then(r => setBanks(r.data)).catch(() => {})
    void api.get<Wallet>('/wallet').then(r => setWallet(r.data)).catch(() => {})
    void api.get<ConsentItem[]>('/consents').then(r => setConsents(r.data)).catch(() => {})

    // Fetch up to 100 entries; filter to current month client-side
    void api.get<LedgerEntry[]>('/ledger?filter=all&limit=100')
      .then(r => {
        const { start, end } = currentMonthRange()
        setLedger(r.data.filter(e => e.entry_date >= start && e.entry_date <= end))
      })
      .catch(() => {})
  }, [])

  /* ── Derived values ───────────────────────────────────────────────── */
  const approvedConsents = consents.filter(c => c.status === 'approved')
  const pendingConsents  = consents.filter(c => c.status === 'pending')

  const monthlyIncome  = ledger.filter(e => e.entry_type === 'income').reduce((s, e) => s + parseFloat(e.amount), 0)
  const monthlyExpense = ledger.filter(e => e.entry_type === 'expense').reduce((s, e) => s + parseFloat(e.amount), 0)
  const estimatedTax   = Math.round(monthlyIncome * 0.075)   // ~7.5% simplified WHT

  const weeklyChart     = toWeeklyChart(ledger)
  const categoryBreakdown = toCategoryBreakdown(ledger)
  const usageData       = toUsageData(consents)

  /* ── Bank names sub-label ─────────────────────────────────────────── */
  const banksSub = banks.length === 0
    ? 'No banks connected yet'
    : banks.length === 1
      ? banks[0].name
      : `${banks[0].name}, ${banks[1]?.name ?? ''}${banks.length > 2 ? ` +${banks.length - 2} more` : ''}`

  /* ── Holder display name ──────────────────────────────────────────── */
  const holderName = user
    ? `${user.firstName} ${user.lastName.charAt(0)}.`
    : credential.holder || '…'

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-neutral-900">
            Welcome back, {user?.firstName ?? 'there'}
          </h1>
          <p className="text-neutral-500 mt-1 text-[13.5px]">
            Here's a snapshot of your identity, credentials, and business finances
          </p>
        </div>
      </div>

      {/* ── Row 1 stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Connected Banks"
          value={banks.length === 0 ? '0' : String(banks.length)}
          sub={banksSub}
          subColor={banks.length > 0 ? 'text-brand-500 font-semibold' : 'text-neutral-400'}
          icon="ri-bank-line"
        />
        <StatCard
          label="Identity Verification"
          value="Verified"
          sub="Tier 2 · Full KYC complete"
          subColor="text-neutral-400"
          icon="ri-shield-user-line"
        />
        <StatCard
          label="Active Credentials"
          value="1"
          sub={
            approvedConsents.length > 0
              ? `Shared with ${approvedConsents.length} platform${approvedConsents.length > 1 ? 's' : ''}`
              : 'Not shared yet'
          }
          subColor="text-green-600 font-semibold"
          icon="ri-book-read-fill"
        />
        <StatCard
          label="AI Credit Balance"
          value={wallet ? wallet.balance.toLocaleString() : '—'}
          sub={wallet ? `Covers ~${Math.floor(wallet.balance / 4)} more scans` : 'Loading…'}
          subColor="text-neutral-400"
          icon="ri-quill-pen-fill"
        />
      </div>

      {/* ── Row 2 stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Monthly Income"
          value={monthlyIncome > 0 ? naira(Math.round(monthlyIncome)) : '—'}
          sub="This month from ledger"
          subColor="text-neutral-400"
          icon="₦"
        />
        <StatCard
          label="Monthly Expense"
          value={monthlyExpense > 0 ? naira(Math.round(monthlyExpense)) : '—'}
          sub="This month from ledger"
          subColor="text-neutral-400"
          icon="ri-hand-coin-line"
        />
        <StatCard
          label="Estimated Taxes"
          value={estimatedTax > 0 ? naira(estimatedTax) : '—'}
          sub="7.5% WHT on income"
          subColor="text-neutral-400"
          icon="ri-percent-line"
        />
        <StatCard
          label="Verification Requests"
          value={String(pendingConsents.length)}
          sub={
            pendingConsents.length === 0
              ? 'No pending requests'
              : `${pendingConsents.length} need${pendingConsents.length === 1 ? 's' : ''} your action`
          }
          subColor={pendingConsents.length > 0 ? 'text-amber-600 font-semibold' : 'text-neutral-400'}
          icon="ri-profile-fill"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-7 py-4">

        {/* Income vs expense chart — real ledger data */}
        <IncomeExpenseChart data={weeklyChart} />

        {/* Credential card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col">
          <div className="font-bold text-[15px] text-neutral-900 mb-4">Your verification credential</div>
          <div className="h-px bg-neutral-100 -mx-5 mb-5" />
          <div className="flex flex-col flex-1 justify-between gap-3">
            <div
              className="relative rounded-2xl overflow-hidden p-5 min-h-[180px] flex flex-col justify-between"
              style={{ background: '#7B61FF' }}
            >
              {/* noise texture */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: 'url(/noise.png)', backgroundSize: '160px', opacity: 0.08 }}
              />

              {/* grid crosshatch overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" style={{ opacity: 0.12 }}>
                <defs>
                  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* shape.png — organic blob, right side */}
              <img
                src="/shape.png"
                alt=""
                aria-hidden="true"
                className="absolute right-0 top-0 h-full pointer-events-none select-none"
                style={{ width: '55%', objectFit: 'cover', objectPosition: 'left center', opacity: 0.95 }}
              />

              {/* Credential state badge — top right */}
              <div className="absolute top-4 right-4 z-10">
                <span
                  className="text-[11px] font-bold px-3 py-1 rounded-full"
                  style={{ background: stateMeta.bg, color: stateMeta.color }}
                >
                  {stateMeta.label}
                </span>
              </div>

              {/* Card content */}
              <div className="relative z-10">
                <div className="text-[11px] font-bold tracking-[2px] text-white/70 uppercase mb-3">FOID</div>
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white/60 uppercase mb-0.5">Credential State</div>
                  <div
                    className="text-[18px] font-extrabold text-white leading-none"
                    style={{ fontFamily: "'Neue Machina', sans-serif" }}
                  >
                    {stateMeta.label}
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-4">
                <div className="text-[10px] font-bold tracking-widest text-white/60 uppercase mb-0.5">Holder</div>
                <div className="text-[15px] font-semibold text-white">{holderName}</div>
              </div>
            </div>

            {/* View FOID code button */}
            <button className="w-full mt-3 py-2.5 border border-neutral-200 rounded-xl text-[13.5px] font-semibold text-neutral-800 flex items-center justify-center gap-2 hover:bg-neutral-50 transition-colors">
              <RemixIcon name="ri-qr-code-line font-normal" size={18} color="#18181b" />
              View my FOID code
            </button>
          </div>
        </div>

        {/* Credential usage bar chart */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <div className="font-bold text-[15px] text-neutral-900 mb-0.5">Where your credential is used</div>
          <div className="text-[12px] text-neutral-400 mb-4">
            {usageData.length > 0 ? 'Approved platform connections' : 'No approved consents yet'}
          </div>
          {usageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={usageData}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                barSize={44}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="platform" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} domain={[0, 80]} />
                <Tooltip
                  formatter={(val, name) => name === 'remainder' ? null : [val, 'Connections']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
                />
                <Bar dataKey="pulls"     stackId="a" fill={BRAND_DEEP} radius={[0, 0, 4, 4]} />
                <Bar dataKey="remainder" stackId="a" fill={BRAND_LITE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-neutral-300">
              <RemixIcon name="ri-bar-chart-2-line" size={48} color="#d4d4d8" />
            </div>
          )}
        </div>

        {/* Spending breakdown */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <div className="font-bold text-[15px] text-neutral-900 mb-0.5">Spending breakdown</div>
          <div className="text-[12px] text-neutral-400 mb-4">
            {categoryBreakdown.length > 0 ? 'This month, by category' : 'No expense entries this month yet'}
          </div>

          <div className="h-px bg-neutral-100 -mx-5 mb-5" />

          {categoryBreakdown.length > 0 ? (
            <>
              <SpendingDonut segments={categoryBreakdown} />
              <div className="flex flex-col gap-[18px] mt-6">
                {(() => {
                  const max = Math.max(...categoryBreakdown.map(c => c.pct))
                  return categoryBreakdown.map(c => (
                    <div
                      key={c.label}
                      className="grid items-center gap-3"
                      style={{ gridTemplateColumns: 'minmax(84px, auto) 1fr' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="text-[13.5px] font-semibold text-neutral-900">{c.label}</span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(c.pct / max) * 100}%`, background: c.color }}
                        />
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-neutral-300">
              <RemixIcon name="ri-pie-chart-2-line" size={48} color="#d4d4d8" />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
