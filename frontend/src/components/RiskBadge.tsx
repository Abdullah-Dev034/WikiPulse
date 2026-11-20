import type { RiskAssessment } from '../types/protocol'
import { StatusDot } from './StatusDot'

export function RiskBadge({ risk }: { risk: RiskAssessment }) {
  if (risk.category === 'normal') return null
  const suspicious = risk.category === 'suspicious'
  return (
    <span
      title={risk.reason}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${suspicious ? 'bg-critical/15 text-critical' : 'bg-warning/15 text-warning'}`}
    >
      <StatusDot tone={suspicious ? 'critical' : 'warning'} />
      {suspicious ? 'Suspicious' : 'Needs review'}
      <span className="opacity-80">· {risk.score}</span>
    </span>
  )
}
