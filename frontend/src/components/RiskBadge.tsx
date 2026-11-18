import type { RiskAssessment } from '../types/protocol'
import { StatusDot } from './StatusDot'

export function RiskBadge({ risk }: { risk: RiskAssessment }) {
  if (risk.category === 'normal') return null
  const suspicious = risk.category === 'suspicious'
  return (
    <span
      title={risk.reason}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-raised px-2 py-0.5 text-xs text-ink"
    >
      <StatusDot tone={suspicious ? 'critical' : 'warning'} />
      {suspicious ? 'Suspicious' : 'Needs review'}
      <span className="text-muted">{risk.score}</span>
    </span>
  )
}
