import { Activity, Globe, PencilLine, ShieldAlert } from 'lucide-react'
import { minuteOverMinute } from '../lib/format'
import type { DashboardStats } from '../types/protocol'
import { MetricCard } from './MetricCard'

export function MetricsRow({ stats }: { stats: DashboardStats }) {
  const change = minuteOverMinute(stats.activity)
  return (
    <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <MetricCard
        label="Edits per minute"
        value={stats.edits_last_minute}
        hint="last 60 seconds"
        icon={Activity}
        change={change === null ? null : { value: change, against: 'vs previous minute' }}
      />
      <MetricCard label="Edits" value={stats.edits_last_5_minutes} hint="last 5 minutes" icon={PencilLine} />
      <MetricCard label="Active wikis" value={stats.active_wikis} hint="last 5 minutes" icon={Globe} />
      <MetricCard
        label="Flagged edits"
        value={stats.suspicious_last_5_minutes}
        hint="needs review or suspicious"
        icon={ShieldAlert}
        tone="attention"
      />
    </dl>
  )
}
