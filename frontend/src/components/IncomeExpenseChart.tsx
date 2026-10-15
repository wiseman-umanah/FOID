import {
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import RemixIcon from './RemixIcon'

const BRAND      = '#c026d3'
const BRAND_LITE = '#f5d0fe'
const PINK       = '#4ade80'

const naira = (n: number) => '₦' + n.toLocaleString('en-NG')

interface DataPoint {
  week: string
  income: number
  expense: number
}

interface IncomeExpenseChartProps {
  data?: DataPoint[]
  height?: number
  title?: string
  subtitle?: string
}

export default function IncomeExpenseChart({
  data = [],
  height = 380,
  title = 'Income vs. expenses',
  subtitle = 'This month from your ledger entries',
}: IncomeExpenseChartProps) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5">
      <div className="font-bold text-[15px] text-neutral-900 mb-0.5">{title}</div>
      <div className="text-[12px] text-neutral-400 mb-4">{subtitle}</div>

      {data.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 text-neutral-400"
          style={{ height }}
        >
          <RemixIcon name="ri-line-chart-line" size={48} color="#d4d4d8" />
          <span className="text-[13px]">No ledger entries this month yet</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="gradIncomeChart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={BRAND}      stopOpacity={0.25} />
                <stop offset="100%" stopColor={BRAND}      stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradExpenseChart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={BRAND_LITE} stopOpacity={0.45} />
                <stop offset="100%" stopColor={BRAND_LITE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, 'dataMax + 20000']}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `₦${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`}
              width={56}
            />
            <Tooltip
              formatter={(val, name) => [naira(Number(val)), name === 'income' ? 'Income' : 'Expenses']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
            />
            <Area type="monotone" dataKey="income" stroke={BRAND} strokeWidth={2} fill="url(#gradIncomeChart)"
              dot={{ r: 3, fill: '#fff', stroke: BRAND, strokeWidth: 2 }}
              activeDot={{ r: 4, fill: BRAND }}
            />
            <Area type="monotone" dataKey="expense" stroke={PINK} strokeWidth={2} fill="url(#gradExpenseChart)"
              dot={{ r: 3, fill: '#fff', stroke: PINK, strokeWidth: 2 }}
              activeDot={{ r: 4, fill: PINK }}
            />
            <Legend
              verticalAlign="bottom"
              align="right"
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              formatter={(value) => (
                <span style={{ color: '#71717a' }}>
                  {value === 'income' ? 'Income' : 'Expenses'}
                </span>
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
