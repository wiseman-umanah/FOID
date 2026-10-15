import { useState, useEffect } from 'react'
import StatCard from '@/components/StatCard'
import RemixIcon from '@/components/RemixIcon'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import type { LedgerEntry } from '@/types/idra'

/* ── Colours ────────────────────────────────────────────────────────── */
const BRAND      = '#c026d3'
const BRAND_LITE = '#f5d0fe'
const PINE       = '#4ade80'

/* ── Helpers ────────────────────────────────────────────────────────── */
const naira = (n: number) => '₦' + Math.abs(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

interface MonthlySummary {
  month: string
  year_month: string
  income: number
  expense: number
  net: number
  tax: number
}

async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const blob = new Blob([res.data as BlobPart], { type: res.headers['content-type'] as string })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href; a.download = filename; a.click()
  URL.revokeObjectURL(href)
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function ReportsPage() {
  const [summaries, setSummaries]     = useState<MonthlySummary[]>([])
  const [entries, setEntries]         = useState<LedgerEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [exporting, setExporting]     = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sumRes, ledgerRes] = await Promise.all([
          api.get<MonthlySummary[]>('/reports/summary'),
          api.get<LedgerEntry[]>('/ledger?filter=all&limit=100'),
        ])
        setSummaries(sumRes.data)
        setEntries(ledgerRes.data)
      } catch {/* non-fatal */}
      finally { setLoading(false) }
    }
    void load()
  }, [])

  const handleExport = (fmt: 'csv' | 'pdf') => {
    if (exporting) return
    setExporting(fmt)
    const today = new Date().toISOString().slice(0, 10)
    void downloadBlob(
      `/reports/export/${fmt}`,
      `idra_report_${today}.${fmt}`,
    ).finally(() => setExporting(null))
  }

  const handleMonthDownload = (yearMonth: string) => {
    if (exporting) return
    setExporting(yearMonth)
    void downloadBlob(
      `/reports/monthly-pdf?month=${yearMonth}`,
      `foid_audit_${yearMonth}.pdf`,
    ).finally(() => setExporting(null))
  }

  /* ── Derived stats ── */
  const totalIncome  = summaries.reduce((s, r) => s + r.income, 0)
  const totalExpense = summaries.reduce((s, r) => s + r.expense, 0)
  const avgMonthlyIncome  = summaries.length ? totalIncome  / summaries.length : 0
  const avgMonthlyExpense = summaries.length ? totalExpense / summaries.length : 0
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0

  /* ── Income vs Expense chart data — last 8 days of entries ── */
  const dailyMap: Record<string, { income: number; expense: number }> = {}
  entries.slice(0, 40).forEach(e => {
    const day = e.entry_date.slice(5)  // MM-DD
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 }
    const amt = parseFloat(e.amount)
    if (e.entry_type === 'income') dailyMap[day].income += amt
    else dailyMap[day].expense += amt
  })
  const chartData = Object.entries(dailyMap).slice(-8).map(([x, v]) => ({ x, ...v }))

  /* ── Income sources bar chart ── */
  const incomeByCategory: Record<string, number> = {}
  entries.filter(e => e.entry_type === 'income').forEach(e => {
    incomeByCategory[e.category] = (incomeByCategory[e.category] ?? 0) + parseFloat(e.amount)
  })
  const incomeSourcesData = Object.entries(incomeByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, amount]) => ({ source, amount }))

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-neutral-900">Reports &amp; Insights</h1>
          <p className="text-neutral-500 mt-1 text-[13.5px]">
            A closer look at your cash flow, spending patterns, and tax position
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-5 py-2.5 border border-neutral-200 rounded-full font-semibold text-[13px] text-neutral-800 bg-white hover:bg-neutral-50 transition-colors disabled:opacity-60"
          >
            <RemixIcon name={exporting === 'csv' ? 'ri-loader-4-line' : 'ri-file-text-line'} size={16} color="#18181b" />
            {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-5 py-2.5 border border-neutral-200 rounded-full font-semibold text-[13px] text-neutral-800 bg-white hover:bg-neutral-50 transition-colors disabled:opacity-60"
          >
            <RemixIcon name={exporting === 'pdf' ? 'ri-loader-4-line' : 'ri-file-pdf-2-line'} size={16} color="#18181b" />
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Net Profit"
          value={loading ? '—' : naira(totalIncome - totalExpense)}
          sub={totalIncome - totalExpense >= 0 ? '↗ Positive overall' : '↘ Net loss overall'}
          subColor={totalIncome - totalExpense >= 0 ? 'text-brand-500 font-semibold' : 'text-red-500 font-semibold'}
          icon="ri-bar-chart-fill"
        />
        <StatCard
          label="Avg. Monthly Income"
          value={loading ? '—' : naira(avgMonthlyIncome)}
          sub={`Over ${summaries.length} month${summaries.length !== 1 ? 's' : ''}`}
          subColor="text-neutral-400"
          icon="ri-arrow-left-down-long-line"
        />
        <StatCard
          label="Avg. Monthly Expense"
          value={loading ? '—' : naira(avgMonthlyExpense)}
          sub="All categories"
          subColor="text-neutral-400"
          icon="ri-arrow-up-right-line"
        />
        <StatCard
          label="Savings Rate"
          value={loading ? '—' : `${savingsRate.toFixed(1)}%`}
          sub="Income retained"
          subColor={savingsRate >= 20 ? 'text-brand-500 font-semibold' : 'text-neutral-400'}
          icon="ri-wallet-line"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">

        {/* Income vs expenses — area chart */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <div className="font-bold text-[15px] text-neutral-900 mb-0.5">Income vs. expenses</div>
          <div className="text-[12px] text-neutral-400 mb-4">
            {chartData.length > 0 ? 'Recent entries from your ledger' : 'No data yet — upload receipts to populate this chart'}
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rGradIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BRAND}      stopOpacity={0.25} />
                    <stop offset="95%" stopColor={BRAND}      stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="rGradExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BRAND_LITE} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={BRAND_LITE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="x" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `₦${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`}
                  width={52}
                />
                <Tooltip
                  formatter={(val, name) => [naira(Number(val)), name === 'income' ? 'Income' : 'Expenses']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
                />
                <Area type="monotone" dataKey="income"
                  stroke={BRAND} strokeWidth={2} fill="url(#rGradIncome)"
                  dot={{ r: 3, fill: '#fff', stroke: BRAND, strokeWidth: 2 }}
                  activeDot={{ r: 4, fill: BRAND }}
                />
                <Area type="monotone" dataKey="expense"
                  stroke={PINE} strokeWidth={2} fill="url(#rGradExpense)"
                  dot={{ r: 3, fill: '#fff', stroke: PINE, strokeWidth: 2 }}
                  activeDot={{ r: 4, fill: PINE }}
                />
                <Legend
                  verticalAlign="bottom" align="right" iconType="circle" iconSize={10}
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  formatter={(value) => (
                    <span style={{ color: '#71717a' }}>{value === 'income' ? 'Income' : 'Expenses'}</span>
                  )}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] gap-3">
              <RemixIcon name="ri-line-chart-line" size={48} color="#d4d4d8" />
              <span className="text-[13px] text-neutral-400">No entries yet</span>
            </div>
          )}
        </div>

        {/* Income sources — bar chart */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <div className="font-bold text-[15px] text-neutral-900 mb-4">Income Sources</div>
          {incomeSourcesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incomeSourcesData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={60} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="source" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `₦${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`}
                  width={52}
                />
                <Tooltip
                  formatter={(val) => [naira(Number(val)), 'Amount']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
                />
                <Bar dataKey="amount" fill={BRAND} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] gap-3">
              <RemixIcon name="ri-bar-chart-2-line" size={48} color="#d4d4d8" />
              <span className="text-[13px] text-neutral-400">No income data yet</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Monthly summary table ── */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          <div className="font-bold text-[15px] text-neutral-900">Monthly summary</div>
          <div className="text-[12px] text-neutral-400 mt-0.5">Click Download to get a full audit PDF for any month</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-neutral-100">
                {['MONTH', 'INCOME', 'EXPENSES', 'NET', 'EST. TAX (7.5%)', 'DOWNLOAD'].map(col => (
                  <th key={col} className="px-6 py-4 text-[11px] font-bold text-neutral-400 uppercase tracking-widest whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-neutral-400">Loading…</td>
                </tr>
              )}
              {!loading && summaries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <RemixIcon name="ri-inbox-line" size={32} color="#d4d4d8" />
                      <span className="text-[13px] text-neutral-400">No ledger data yet — upload receipts to generate monthly summaries</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && summaries.map(row => (
                <tr key={row.year_month} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 transition-colors">
                  <td className="px-6 py-5 text-[14px] font-semibold text-neutral-900">{row.month}</td>
                  <td className="px-6 py-5 text-[13px] text-brand-600 font-semibold">{naira(row.income)}</td>
                  <td className="px-6 py-5 text-[13px] text-red-500">{naira(row.expense)}</td>
                  <td className="px-6 py-5 text-[13px] font-semibold" style={{ color: row.net >= 0 ? '#c026d3' : '#dc2626' }}>
                    {row.net >= 0 ? '+' : ''}{naira(row.net)}
                  </td>
                  <td className="px-6 py-5 text-[13px] text-neutral-700">{naira(row.tax)}</td>
                  <td className="px-6 py-5">
                    <button
                      onClick={() => handleMonthDownload(row.year_month)}
                      disabled={exporting !== null}
                      className="flex items-center gap-2 px-4 py-1.5 border border-neutral-200 rounded-full text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                    >
                      <RemixIcon
                        name={exporting === row.year_month ? 'ri-loader-4-line' : 'ri-download-fill'}
                        size={14}
                        color="#52525b"
                      />
                      {exporting === row.year_month ? 'Downloading…' : 'Download'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
