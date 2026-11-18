export type StatusTone = 'live' | 'good' | 'warning' | 'critical' | 'neutral'

const toneClass: Record<StatusTone, string> = {
  live: 'bg-accent',
  good: 'bg-good',
  warning: 'bg-warning',
  critical: 'bg-critical',
  neutral: 'bg-muted',
}

export function StatusDot({ tone }: { tone: StatusTone }) {
  return (
    <span aria-hidden className="relative inline-flex size-2 shrink-0">
      {tone === 'live' && (
        <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
      )}
      <span className={`relative inline-flex size-2 rounded-full ${toneClass[tone]}`} />
    </span>
  )
}
