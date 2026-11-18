export type StatusTone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral'

const toneClass: Record<StatusTone, string> = {
  good: 'bg-good',
  warning: 'bg-warning',
  serious: 'bg-serious',
  critical: 'bg-critical',
  neutral: 'bg-muted',
}

export function StatusDot({ tone }: { tone: StatusTone }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${toneClass[tone]}`} />
}
