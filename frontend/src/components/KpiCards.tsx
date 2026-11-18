import { formatNumber } from '../lib/format'
import type { DashboardStats } from '../types/protocol'

export function KpiCards({ stats }: { stats: DashboardStats }) {
  const kpis = [
    { label: 'Edits per minute', value: stats.edits_last_minute, hint: 'last 60 seconds' },
    { label: 'Edits', value: stats.edits_last_5_minutes, hint: 'last 5 minutes' },
    { label: 'Active wikis', value: stats.active_wikis, hint: 'last 5 minutes' },
    {
      label: 'Flagged edits',
      value: stats.suspicious_last_5_minutes,
      hint: 'needs review or suspicious',
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-xl border border-line bg-panel p-4">
          <dt className="text-xs text-muted">{kpi.label}</dt>
          <dd className="mt-1 text-3xl font-semibold">{formatNumber(kpi.value)}</dd>
          <dd className="mt-1 text-xs text-muted">{kpi.hint}</dd>
        </div>
      ))}
    </dl>
  )
}
