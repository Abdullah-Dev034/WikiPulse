import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { formatNumber } from '../lib/format'

export type MetricTone = 'default' | 'attention'

interface MetricCardProps {
  label: string
  value: number
  hint: string
  icon: LucideIcon
  tone?: MetricTone
  /** Fractional change against a comparable earlier window; omit when there is none. */
  change?: { value: number; against: string } | null
}

export function MetricCard({ label, value, hint, icon: Icon, tone = 'default', change }: MetricCardProps) {
  const attention = tone === 'attention' && value > 0
  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-line bg-panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[13px] leading-snug font-medium text-muted">{label}</dt>
        <span
          aria-hidden
          className={`grid size-8 shrink-0 place-items-center rounded-md ${attention ? 'bg-warning/15 text-warning' : 'bg-panel-raised text-ink-2'}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <dd className="text-2xl font-semibold tracking-tight text-ink sm:text-[32px] sm:leading-none">
        {formatNumber(value)}
      </dd>
      <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {change && <ChangeBadge change={change.value} against={change.against} />}
        <span>{hint}</span>
      </dd>
    </div>
  )
}

function ChangeBadge({ change, against }: { change: number; against: string }) {
  const up = change >= 0
  const Arrow = up ? ArrowUpRight : ArrowDownRight
  const percent = `${up ? '+' : '−'}${Math.round(Math.abs(change) * 100)}%`
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded bg-panel-raised px-1.5 py-0.5 font-medium text-ink-2"
      title={`${percent} ${against}`}
    >
      <Arrow aria-hidden className="size-3.5" />
      {percent}
      <span className="sr-only"> {against}</span>
    </span>
  )
}
