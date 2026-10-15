import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import RemixIcon from '@/components/RemixIcon'
import StatCard from '@/components/StatCard'
import type { LedgerEntry } from '@/types/idra'
import { api } from '@/lib/api'

/* ── Helpers ────────────────────────────────────────────────────────── */
function fmtNGN(n: number): string {
  return '₦' + Math.abs(n).toLocaleString('en-NG')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Entries that fall in the current calendar month */
function currentMonth(entries: LedgerEntry[]): LedgerEntry[] {
  const now = new Date()
  return entries.filter(e => {
    const d = new Date(e.entry_date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
}

/* ── Spend categories derived from real entries ──────────────────────── */
interface SpendCat { label: string; value: number }

function buildSpendCategories(entries: LedgerEntry[]): SpendCat[] {
  const map: Record<string, number> = {}
  for (const e of entries) {
    if (e.entry_type !== 'expense') continue
    const amt = parseFloat(e.amount)
    map[e.category] = (map[e.category] ?? 0) + amt
  }
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
}

/* ── Donut chart ─────────────────────────────────────────────────────── */
const PALETTE = ['#c026d3', '#e879f9', '#d4d4d8', '#d946ef', '#f5d0fe']
const GAP_DEG = 3

interface DonutSeg { color: string; pct: number }

function SpendDonut({ cats, totalSpend }: { cats: SpendCat[]; totalSpend: number }) {
  const SIZE = 200, CX = 100, CY = 100, R = 74, SW = 18
  const circ = 2 * Math.PI * R

  const segs: DonutSeg[] = cats.map((c, i) => ({
    color: PALETTE[i % PALETTE.length],
    pct: totalSpend > 0 ? Math.round((c.value / totalSpend) * 100) : 0,
  }))

  let cursor = -90
  const segments = segs.map(s => {
    const spanDeg = (s.pct / 100) * 360 - GAP_DEG
    const entry = { ...s, startDeg: cursor + GAP_DEG / 2, spanDeg }
    cursor += (s.pct / 100) * 360
    return entry
  })

  const toArc = (deg: number) => {
    const frac = deg / 360
    return `${frac * circ} ${circ - frac * circ}`
  }

  if (totalSpend === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <RemixIcon name="ri-pie-chart-2-line" size={48} color="#d4d4d8" />
        <span className="text-[13px] text-neutral-400">No expense data yet</span>
      </div>
    )
  }

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f4f4f5" strokeWidth={SW} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={toArc(s.spanDeg)}
            transform={`rotate(${s.startDeg} ${CX} ${CY})`}
          />
        ))}
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[22px] font-extrabold text-neutral-900 leading-none">{fmtNGN(totalSpend)}</div>
        <div className="text-[11px] text-neutral-400 mt-1">total spend</div>
      </div>
      {/* Floating pct badges */}
      {segments.map((s, i) => {
        const midDeg = s.startDeg + s.spanDeg / 2
        const rad = (midDeg * Math.PI) / 180
        const bx = CX + R * Math.cos(rad)
        const by = CY + R * Math.sin(rad)
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center rounded-full text-white font-bold"
            style={{
              width: 26, height: 26,
              background: s.color,
              fontSize: 10,
              left: bx,
              top: by,
              transform: 'translate(-50%,-50%)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            }}
          >
            {s.pct}
          </div>
        )
      })}
    </div>
  )
}

/* ── Category progress bar row ───────────────────────────────────────── */
function CatRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] font-semibold text-neutral-800 w-[80px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[13px] font-semibold text-neutral-800 w-[80px] text-right shrink-0">{fmtNGN(value)}</span>
    </div>
  )
}

/* ── Source icon ─────────────────────────────────────────────────────── */
function SourceIcon({ source }: { source: string }) {
  const map: Record<string, string> = {
    receipt: 'ri-receipt-line',
    invoice: 'ri-file-text-line',
    bank:    'ri-bank-line',
  }
  return <RemixIcon name={map[source.toLowerCase()] ?? 'ri-file-line'} size={14} color="#a1a1aa" />
}

/* ── Category pill ───────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  Logistics: { bg: '#eff6ff', color: '#2563eb' },
  Sales:     { bg: '#f0fdf4', color: '#c026d3' },
  Software:  { bg: '#faf5ff', color: '#7c3aed' },
  Payroll:   { bg: '#fae8ff', color: '#c026d3' },
  Marketing: { bg: '#fff7ed', color: '#c2410c' },
  Other:     { bg: '#f4f4f5', color: '#71717a' },
}
function CategoryPill({ label }: { label: string }) {
  const c = CAT_COLORS[label] ?? { bg: '#f4f4f5', color: '#71717a' }
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-full text-[11.5px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.color }}
    >
      {label}
    </span>
  )
}

/* ── Upload state ────────────────────────────────────────────────────── */
type UploadState = 'idle' | 'uploading' | 'success' | 'error' | 'no_credits'

/* ════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 5

export default function BusinessLedger() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging]         = useState(false)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [page, setPage]                 = useState(1)
  const [entries, setEntries]           = useState<LedgerEntry[]>([])
  const [wallet, setWallet]             = useState<{ balance: number } | null>(null)
  const [uploadState, setUploadState]   = useState<UploadState>('idle')
  const [uploadError, setUploadError]   = useState('')
  const [loading, setLoading]           = useState(true)

  /* ── Fetch on mount ── */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [ledgerRes, walletRes] = await Promise.all([
          api.get<LedgerEntry[]>('/ledger?filter=all&limit=100'),
          api.get<{ balance: number }>('/wallet'),
        ])
        setEntries(ledgerRes.data)
        setWallet(walletRes.data)
      } catch {
        // non-fatal — show empty states
      } finally {
        setLoading(false)
      }
    }
    void fetchData()
  }, [])

  /* ── Refresh entries (after upload) ── */
  const refreshEntries = async () => {
    try {
      const [ledgerRes, walletRes] = await Promise.all([
        api.get<LedgerEntry[]>('/ledger?filter=all&limit=100'),
        api.get<{ balance: number }>('/wallet'),
      ])
      setEntries(ledgerRes.data)
      setWallet(walletRes.data)
    } catch {/* ignore */}
  }

  /* ── Derived stats ── */
  const mtdEntries  = currentMonth(entries)
  const totalIncome  = mtdEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + parseFloat(e.amount), 0)
  const totalExpense = mtdEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + parseFloat(e.amount), 0)
  const netProfit    = totalIncome - totalExpense
  const estimatedTax = Math.round(netProfit * 0.075)

  /* ── Spend breakdown (all-time expenses) ── */
  const spendCats  = buildSpendCategories(entries)
  const totalSpend = spendCats.reduce((s, c) => s + c.value, 0)
  const spendMax   = spendCats[0]?.value ?? 1

  /* ── Pagination ── */
  const totalPages  = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleRow = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  /* ── Upload handler ── */
  const handleUpload = async (file: File) => {
    setUploadState('uploading')
    setUploadError('')
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post('/ledger/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadState('success')
      await refreshEntries()
      setTimeout(() => setUploadState('idle'), 3000)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        setUploadState('no_credits')
        setUploadError('Not enough credits. Top up your AI Credit Wallet to scan more receipts.')
      } else {
        setUploadState('error')
        setUploadError('Upload failed. Please try again.')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleUpload(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleUpload(file)
  }

  const creditsBalance = wallet?.balance ?? 0

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-neutral-900">Business Ledger</h1>
          <p className="text-neutral-500 mt-1 text-[13.5px]">
            Snap a receipt, forward an invoice, or just ask — FOID's AI keeps your books for you
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState === 'uploading'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-[14px] text-white transition-opacity hover:opacity-90 shrink-0 self-start disabled:opacity-60"
          style={{ background: '#c026d3' }}
        >
          <RemixIcon name="ri-camera-fill" size={18} color="#fff" />
          {uploadState === 'uploading' ? 'Scanning…' : 'Scan receipt'}
          <span
            className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.25)' }}
          >
            {creditsBalance} cr
          </span>
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Income (MTD)"
          value={loading ? '—' : fmtNGN(totalIncome)}
          sub={totalIncome > 0 ? 'This month' : 'No income yet'}
          subColor="text-brand-500 font-semibold"
          icon="ri-arrow-left-down-long-line"
        />
        <StatCard
          label="Total Expenses (MTD)"
          value={loading ? '—' : fmtNGN(totalExpense)}
          sub={totalIncome > 0 ? `${totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0}% of income` : 'No expenses yet'}
          subColor="text-neutral-400"
          icon="ri-arrow-right-up-long-line"
        />
        <StatCard
          label="Net Profit"
          value={loading ? '—' : fmtNGN(netProfit)}
          sub={netProfit >= 0 ? '↗ Profitable this month' : '↘ Net loss this month'}
          subColor={netProfit >= 0 ? 'text-brand-500 font-semibold' : 'text-red-500 font-semibold'}
          icon="ri-bar-chart-fill"
        />
        <StatCard
          label="Estimated Tax (7.5%)"
          value={loading ? '—' : fmtNGN(Math.max(0, estimatedTax))}
          sub="Set aside for this quarter"
          subColor="text-neutral-400"
          icon="ri-bank-fill"
        />
      </div>

      {/* ── Middle row: upload card + spend breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Add a record — upload zone */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-bold text-neutral-900">Add a record</div>
              <div className="text-[12.5px] text-neutral-400 mt-0.5">Upload a receipt, invoice, or bank statement — AI does the rest</div>
            </div>
            <span
              className="text-[11.5px] font-semibold px-3 py-1 rounded-full shrink-0"
              style={{ background: '#dcfce7', color: '#c026d3' }}
            >
              ~4 credits / scan
            </span>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => uploadState === 'idle' && fileInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl py-12 transition-colors cursor-pointer"
            style={{
              border: `2px dashed ${dragging ? '#c026d3' : uploadState === 'error' || uploadState === 'no_credits' ? '#dc2626' : '#e879f9'}`,
              background: '#fdf4ff',
              minHeight: 260,
            }}
          >
            {uploadState === 'uploading' && (
              <>
                <RemixIcon name="ri-loader-4-line" size={56} color="#c026d3" className="animate-spin" />
                <p className="text-[14px] text-neutral-700 font-medium">Scanning with AI…</p>
              </>
            )}

            {uploadState === 'success' && (
              <>
                <RemixIcon name="ri-checkbox-circle-fill" size={56} color="#c026d3" />
                <p className="text-[14px] font-bold text-brand-600">Receipt scanned successfully!</p>
                <p className="text-[12px] text-neutral-400">Entry added to your ledger</p>
              </>
            )}

            {(uploadState === 'error' || uploadState === 'no_credits') && (
              <>
                <RemixIcon name="ri-error-warning-line" size={56} color="#dc2626" />
                <p className="text-[14px] font-bold text-red-600">
                  {uploadState === 'no_credits' ? 'No credits' : 'Upload failed'}
                </p>
                <p className="text-[12px] text-neutral-500 text-center px-4">{uploadError}</p>
                <button
                  onClick={e => { e.stopPropagation(); setUploadState('idle') }}
                  className="mt-1 px-5 py-2 rounded-full text-[13px] font-bold text-white"
                  style={{ background: '#c026d3' }}
                >
                  Try again
                </button>
              </>
            )}

            {uploadState === 'idle' && (
              <>
                <RemixIcon name="ri-upload-cloud-2-line" size={84} color="#c026d3" />
                <div className="text-center">
                  <p className="text-[14px] text-neutral-700">
                    <span className="font-bold text-neutral-900">Drop a file here</span> or click to browse
                  </p>
                  <p className="text-[12px] text-neutral-400 mt-1">JPG, PNG, PDF up to 10MB — receipts, invoices, statements</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                  className="mt-1 px-6 py-2.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#c026d3' }}
                >
                  Upload Image
                </button>
              </>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Spend breakdown — donut + bars */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-5">
          <div className="text-[15px] font-bold text-neutral-900">Spend breakdown</div>
          <SpendDonut cats={spendCats} totalSpend={totalSpend} />
          {spendCats.length > 0 && (
            <div className="flex flex-col gap-3 mt-1">
              {spendCats.map((c, i) => (
                <CatRow
                  key={c.label}
                  label={c.label}
                  value={c.value}
                  max={spendMax}
                  color={PALETTE[i % PALETTE.length]}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Latest AI-categorised entries table ── */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">

        {/* Table toolbar */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 gap-4">
          <div>
            <div className="text-[15px] font-bold text-neutral-900">Latest AI-categorised entries</div>
            <div className="text-[12px] text-neutral-400 mt-0.5">Auto-extracted from uploaded documents</div>
          </div>
          <button
            onClick={() => navigate('/dashboard/history')}
            className="px-4 py-2 rounded-full border border-neutral-200 text-[12.5px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
          >
            View full ledger
          </button>
        </div>

        {/* Table — scrollable on mobile */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: 780 }}>
            <thead>
              <tr className="border-y border-neutral-100 bg-neutral-50">
                <th className="pl-6 pr-3 py-3 w-10">
                  <input type="checkbox" className="accent-[#c026d3] w-4 h-4 rounded" readOnly />
                </th>
                {['DATE', 'DESCRIPTION', 'CATEGORY', 'TYPE', 'AMOUNT', 'SOURCE', 'CONFIDENCE', 'ACTIONS'].map(col => (
                  <th
                    key={col}
                    className="px-3 py-3 text-[11px] font-bold text-neutral-400 uppercase tracking-widest whitespace-nowrap last:pr-6"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[13px] text-neutral-400">
                    Loading entries…
                  </td>
                </tr>
              )}
              {!loading && pageEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <RemixIcon name="ri-inbox-line" size={36} color="#d4d4d8" />
                      <span className="text-[13px] text-neutral-400">No entries yet — upload a receipt to get started</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && pageEntries.map(entry => (
                <tr
                  key={entry.id}
                  className={`hover:bg-neutral-50/60 transition-colors ${selected.has(entry.id) ? 'bg-brand-50' : ''}`}
                >
                  <td className="pl-6 pr-3 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleRow(entry.id)}
                      className="accent-[#c026d3] w-4 h-4 rounded"
                    />
                  </td>
                  <td className="px-3 py-4 text-[13px] text-neutral-500 whitespace-nowrap">{formatDate(entry.entry_date)}</td>
                  <td className="px-3 py-4 text-[13px] font-medium text-neutral-800 max-w-[200px]">{entry.description}</td>
                  <td className="px-3 py-4"><CategoryPill label={entry.category} /></td>
                  <td className="px-3 py-4 text-[13px] text-neutral-600 capitalize">{entry.entry_type}</td>
                  <td
                    className="px-3 py-4 text-[13px] font-semibold whitespace-nowrap"
                    style={{ color: entry.entry_type === 'income' ? '#c026d3' : '#dc2626' }}
                  >
                    {entry.entry_type === 'income' ? '+' : '-'}{fmtNGN(parseFloat(entry.amount))}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1.5 text-[12.5px] text-neutral-500 capitalize">
                      <SourceIcon source={entry.source} />
                      {entry.source}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-[13px] text-neutral-600 whitespace-nowrap">
                    {Math.round(entry.confidence * 100)}%
                  </td>
                  <td className="px-3 py-4 pr-6">
                    <button className="flex items-center gap-1 text-[12.5px] font-semibold text-neutral-600 hover:text-brand-500 transition-colors">
                      <RemixIcon name="ri-pencil-line" size={13} color="currentColor" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-t border-neutral-100">
          <span className="text-[13px] text-neutral-500">
            Showing <span className="font-semibold text-neutral-800">{pageEntries.length}</span> of{' '}
            <span className="font-semibold text-neutral-800">{entries.length}</span> ledger entries
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
            >
              <RemixIcon name="ri-arrow-left-s-line" size={16} color="currentColor" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[13px] font-semibold transition-colors"
                style={
                  page === p
                    ? { background: '#c026d3', color: '#fff' }
                    : { background: 'transparent', color: '#71717a' }
                }
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
            >
              <RemixIcon name="ri-arrow-right-s-line" size={16} color="currentColor" />
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
