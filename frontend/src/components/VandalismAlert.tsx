import { ChevronDown, ExternalLink, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { formatTime, shortWiki } from '../lib/format'
import { describePage } from '../lib/pages'
import type { AIReview, ScoredEvent, Verdict } from '../types/protocol'
import { RiskBadge } from './RiskBadge'

const VERDICT_LABELS: Record<Verdict, string> = {
  likely_vandalism: 'likely vandalism',
  unclear: 'unclear',
  likely_fine: 'likely fine',
}

export function VandalismAlert({ item, review }: { item: ScoredEvent; review?: AIReview }) {
  const { event, risk } = item
  const [open, setOpen] = useState(false)
  const page = describePage(event.domain, event.title)
  const suspicious = risk.category === 'suspicious'
  const detailsId = `alert-${event.id}`

  return (
    <li
      className={`animate-enter rounded-md border-l-2 bg-panel-raised/40 ${suspicious ? 'border-critical' : 'border-warning'}`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left outline-none hover:bg-panel-raised/60 focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <RiskBadge risk={risk} />
            {review && (
              <span className="inline-flex items-center gap-1 rounded bg-panel-raised px-1.5 py-0.5 text-xs text-ink-2">
                <Sparkles aria-hidden className="size-3 text-accent" />
                AI: {VERDICT_LABELS[review.verdict]}
              </span>
            )}
            {page.kind && <span className="text-xs text-muted">{page.kind}</span>}
          </span>
          <span className="mt-1 block truncate text-sm font-semibold text-ink">{page.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {shortWiki(event.domain)} · {event.user || 'hidden user'} · {formatTime(event.timestamp)}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={`mt-1 size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
        <span className="sr-only">{open ? 'Hide details' : 'Show details'}</span>
      </button>

      {open && (
        <div id={detailsId} className="space-y-3 px-3 pb-3 text-[13px]">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Rule-based signals
            </p>
            <ul className="mt-1.5 space-y-1">
              {risk.signals.map((signal) => (
                <li key={signal.code} className="flex items-start justify-between gap-3 text-ink-2">
                  <span>{signal.description}</span>
                  <span className="shrink-0 text-xs text-muted">+{signal.weight}</span>
                </li>
              ))}
            </ul>
          </div>
          {review && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted uppercase">
                AI second opinion · advisory
              </p>
              <p className="mt-1.5 text-ink-2">
                <span className="font-medium text-ink">{VERDICT_LABELS[review.verdict]}</span>
                {' — '}
                {review.reason}
              </p>
              <p className="mt-1 text-xs text-muted">
                From {review.model}, using metadata only. It does not change the rule-based flag.
              </p>
            </div>
          )}
          {event.diff_url && (
            <a
              href={event.diff_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Review the diff on {shortWiki(event.domain)} <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
        </div>
      )}
    </li>
  )
}
