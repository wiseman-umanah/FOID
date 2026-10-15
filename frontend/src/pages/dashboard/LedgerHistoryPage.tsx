import { useState, useEffect } from 'react'
import RemixIcon from '@/components/RemixIcon'
import StatCard from '@/components/StatCard'
import type { LedgerEntry } from '@/types/idra'
import { api } from '@/lib/api'

/* ── Export helper ───────────────────────────────────────────────────── */
async function downloadExport(format: 'csv' | 'pdf') {
  const res = await api.get(`/ledger/export/${format}`, { responseType: 'blob' })
  const mime  = format === 'csv' ? 'text/csv' : 'application/pdf'
  const ext   = format
  const blob  = new Blob([res.data as BlobPart], { type: mime })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = `foid_ledger_${new Date().toISOString().slice(0, 10)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function formatAmount(entry: LedgerEntry): string {
  const n = parseFloat(entry.amount)
  const sign = entry.entry_type === 'income' ? '+' : '-'
  return `${sign}₦${Math.abs(n).toLocaleString('en-NG')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ── Category pill — outlined style from screenshot ─────────────────── */
const CAT_COLORS: Record<string, { border: string; color: string }> = {
  Logistics: { border: '#bfdbfe', color: '#2563eb' },
  Sales:     { border: '#bbf7d0', color: '#c026d3' },
  Software:  { border: '#ddd6fe', color: '#7c3aed' },
  Payroll:   { border: '#f5d0fe', color: '#c026d3' },
  Marketing: { border: '#fed7aa', color: '#c2410c' },
  Utilities: { border: '#fde68a', color: '#92400e' },
  Other:     { border: '#d4d4d8', color: '#71717a' },
}
function CategoryPill({ label }: { label: string }) {
  const c = CAT_COLORS[label] ?? { border: '#d4d4d8', color: '#71717a' }
  return (
    <span
      className="inline-flex px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap"
      style={{ border: `1px solid ${c.border}`, color: c.color, background: 'transparent' }}
    >
      {label}
    </span>
  )
}

/* ── Filter tabs ─────────────────────────────────────────────────────── */
type Filter = 'All' | 'Income' | 'Expense'
const TABS: Filter[] = ['All', 'Income', 'Expense']

/* ════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 7

export default function LedgerHistory() {
  const [filter, setFilter]     = useState<Filter>('All')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [entries, setEntries]   = useState<LedgerEntry[]>([])
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  const handleExport = (fmt: 'csv' | 'pdf') => {
    if (exporting) return
    setExporting(fmt)
    void downloadExport(fmt).finally(() => setExporting(null))
  }

  useEffect(() => {
    const filterParam = filter === 'All' ? 'all' : filter.toLowerCase()
    void api.get<LedgerEntry[]>(`/ledger?filter=${filterParam}&limit=100`)
      .then(res => { setEntries(res.data); setPage(1) })
  }, [filter])

  /* Search on already-loaded page */
  const filtered = entries.filter(e => {
    if (search) {
      const q = search.toLowerCase()
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const pageEntries = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const toggleRow = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allChecked = pageEntries.length > 0 && pageEntries.every(e => selected.has(e.id))
  const toggleAll  = () => {
    if (allChecked) {
      setSelected(prev => {
        const next = new Set(prev)
        pageEntries.forEach(e => next.delete(e.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        pageEntries.forEach(e => next.add(e.id))
        return next
      })
    }
  }

  const handleFilterChange = (f: Filter) => { setFilter(f); setPage(1) }
  const handleSearch = (v: string)        => { setSearch(v); setPage(1) }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-neutral-900">Ledger History</h1>
          <p className="text-neutral-500 mt-1 text-[13.5px]">
            Every AI-generated ledger entry — searchable, editable, and exportable
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-full text-[13px] font-semibold text-neutral-800 bg-white hover:bg-neutral-50 transition-colors disabled:opacity-60"
          >
            <RemixIcon name={exporting === 'csv' ? 'ri-loader-4-line' : 'ri-file-text-line'} size={16} color="#18181b" />
            {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-full text-[13px] font-semibold text-neutral-800 bg-white hover:bg-neutral-50 transition-colors disabled:opacity-60"
          >
            <RemixIcon name={exporting === 'pdf' ? 'ri-loader-4-line' : 'ri-file-pdf-2-line'} size={16} color="#18181b" />
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Entries"      value={String(entries.length)} sub="Loaded entries"       subColor="text-neutral-400" icon="ri-list-check-2"          />
        <StatCard label="Auto-categorised"   value="AI"                     sub="Groq OCR categorised" subColor="text-neutral-400" icon="ri-arrow-right-up-line"    />
        <StatCard label="Exports This Month" value="—"                      sub="CSV & PDF combined"   subColor="text-neutral-400" icon="ri-bar-chart-grouped-line" />
        <StatCard label="Estimated Tax"      value="—"                      sub="Full history kept"    subColor="text-neutral-400" icon="ri-wallet-line"             />
      </div>

      {/* ── Table card ── */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">

        {/* ── Filter tabs + search row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-5 pb-4">

          {/* Sliding-pill tabs */}
          <div
            className="flex items-center rounded-full p-1 shrink-0"
            style={{ background: '#f0f0f0' }}
          >
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => handleFilterChange(tab)}
                className="px-4 sm:px-6 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap"
                style={
                  filter === tab
                    ? { background: '#fff', color: '#18181b', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                    : { background: 'transparent', color: '#9a9a9a' }
                }
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-[300px]">
            <RemixIcon
              name="ri-search-line"
              size={15}
              color="#a1a1aa"
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search description, amounts, tag"
              className="w-full pl-9 pr-4 py-2 rounded-full border border-neutral-200 bg-neutral-50 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-brand-400 transition-colors"
            />
          </div>
        </div>

        {/* ── Table — scrollable on mobile ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: 820 }}>
            <thead>
              <tr className="border-y border-neutral-100" style={{ background: '#fafafa' }}>
                {/* Select-all checkbox */}
                <th className="pl-6 pr-3 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded-full accent-[#c026d3]"
                  />
                </th>
                {['DATE', 'DESCRIPTION', 'CATEGORY', 'TYPE', 'AMOUNT', 'SOURCE', 'CONFIDENCE', 'ACTIONS'].map(col => (
                  <th
                    key={col}
                    className="px-3 py-3.5 text-[11.5px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap last:pr-6"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pageEntries.map(entry => (
                <tr
                  key={entry.id}
                  className={`transition-colors hover:bg-neutral-50/60 ${selected.has(entry.id) ? 'bg-brand-50' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="pl-6 pr-3 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleRow(entry.id)}
                      className="w-4 h-4 rounded-full accent-[#c026d3]"
                    />
                  </td>

                  {/* Date */}
                  <td className="px-3 py-4 text-[13px] font-semibold text-neutral-800 whitespace-nowrap">
                    {formatDate(entry.entry_date)}
                  </td>

                  {/* Description */}
                  <td className="px-3 py-4 text-[13px] text-neutral-700 max-w-[200px] leading-snug">
                    {entry.description}
                  </td>

                  {/* Category */}
                  <td className="px-3 py-4">
                    <CategoryPill label={entry.category} />
                  </td>

                  {/* Type */}
                  <td className="px-3 py-4 text-[13px] text-neutral-600 capitalize">
                    {entry.entry_type}
                  </td>

                  {/* Amount */}
                  <td
                    className="px-3 py-4 text-[13px] font-semibold whitespace-nowrap"
                    style={{ color: entry.entry_type === 'income' ? '#c026d3' : '#dc2626' }}
                  >
                    {formatAmount(entry)}
                  </td>

                  {/* Source */}
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1.5 text-[13px] text-neutral-600 capitalize">
                      <RemixIcon name="ri-receipt-line" size={14} color="#a1a1aa" />
                      {entry.source}
                    </div>
                  </td>

                  {/* Confidence */}
                  <td className="px-3 py-4 text-[13px] text-neutral-600 whitespace-nowrap">
                    {Math.round(entry.confidence * 100)}%
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-4 pr-6">
                    <button className="flex items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-brand-500 transition-colors">
                      <RemixIcon name="ri-pencil-line" size={13} color="currentColor" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {pageEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[13px] text-neutral-400">
                    No entries match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-neutral-100">
          <span className="text-[13px] text-neutral-600">
            Showing{' '}
            <span className="font-semibold text-neutral-900">{pageEntries.length}</span>
            {' '}of{' '}
            <span className="font-semibold text-neutral-900">{filtered.length}</span>
            {' '}ledger entries
          </span>

          <div className="flex items-center gap-1.5">
            {/* Prev */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
            >
              <RemixIcon name="ri-arrow-left-s-line" size={16} color="currentColor" />
            </button>

            {/* Page numbers — show up to 5 around current */}
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[13px] font-semibold transition-colors"
                style={
                  safePage === p
                    ? { background: '#c026d3', color: '#fff' }
                    : { background: 'transparent', color: '#71717a' }
                }
              >
                {p}
              </button>
            ))}

            {/* Next */}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
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
