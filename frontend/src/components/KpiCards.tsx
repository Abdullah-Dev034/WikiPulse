import { Activity, Globe, PencilLine, ShieldAlert, type LucideIcon } from 'lucide-react'
import { formatNumber } from '../lib/format'
import type { DashboardStats } from '../types/protocol'

interface Kpi {
  label: string
  value: number
  hint: string
  icon: LucideIcon
}

export function KpiCards({ stats }: { stats: DashboardStats }) {
  const kpis: Kpi[] = [
    {
      label: 'Edits per minute',
      value: stats.edits_last_minute,
      hint: 'last 60 seconds',
      icon: Activity,
    },
    { label: 'Edits', value: stats.edits_last_5_minutes, hint: 'last 5 minutes', icon: PencilLine },
    { label: 'Active wikis', value: stats.active_wikis, hint: 'last 5 minutes', icon: Globe },
    {
      label: 'Flagged edits',
      value: stats.suspicious_last_5_minutes,
      hint: 'needs review or suspicious',
      icon: ShieldAlert,
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map(({ label, value, hint, icon: Icon }) => (
        <div
          key={label}
          className="flex items-start justify-between gap-3 rounded-xl border border-line bg-panel p-5 shadow-sm"
        >
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{formatNumber(value)}</dd>
            <dd className="mt-1 text-xs text-muted">{hint}</dd>
          </div>
          <span
            aria-hidden
            className="hidden size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent sm:grid"
          >
            <Icon className="size-5" />
          </span>
        </div>
      ))}
    </dl>
  )
}
