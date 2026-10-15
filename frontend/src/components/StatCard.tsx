import Card from './Card'
import RemixIcon from './RemixIcon'

interface StatCardProps {
  label: string
  value: string
  sub: string
  subColor?: string
  icon: string
}

export default function StatCard({ label, value, sub, subColor = 'text-neutral-400', icon }: StatCardProps) {
  return (
    <Card>
      <div className="flex justify-between">
        <div>
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">{label}</div>
          <div className="text-2xl font-bold text-neutral-900 mb-1">{value}</div>
          <div className={`text-[12px] font-medium ${subColor}`}>{sub}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
          {icon.startsWith('ri-')
            ? <RemixIcon name={icon} size={20} color="#c026d3" />
            : <span style={{ fontSize: 18, fontWeight: 800, color: '#c026d3', lineHeight: 1 }}>{icon}</span>
          }
        </div>
      </div>
    </Card>
  )
}
