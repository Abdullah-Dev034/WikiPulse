import { AlertTriangle, Sparkles } from 'lucide-react'
import { formatTime } from '../lib/format'
import type { PulseSummary } from '../types/protocol'

/**
 * AI pulse: a short summary written by an LLM from this page's aggregate statistics.
 * Every state is explicit, so viewers can tell AI text from data and stale text from fresh.
 */
export function AIInsightPanel({ pulse }: { pulse: PulseSummary }) {
  return (
    <section
      aria-label="AI pulse"
      className="flex items-start gap-3 rounded-lg border border-line bg-panel px-5 py-4"
    >
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-panel-raised text-accent">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-semibold text-ink">AI pulse</h2>
          {pulse.model && pulse.text && (
            <span className="text-xs text-muted">AI-generated · {pulse.model}</span>
          )}
        </div>
        <PulseBody pulse={pulse} />
      </div>
    </section>
  )
}

function PulseBody({ pulse }: { pulse: PulseSummary }) {
  switch (pulse.status) {
    case 'disabled':
      return (
        <p className="mt-0.5 text-sm text-muted">
          AI summaries are turned off. Set an OpenAI-compatible model in <code>backend/.env</code>{' '}
          (<code>LLM_*</code>) to get a short summary of what is trending, written only from the
          statistics on this page.
        </p>
      )
    case 'pending':
      return <p className="mt-0.5 text-sm text-muted">Writing the first summary…</p>
    case 'ok':
    case 'error':
      return (
        <>
          {pulse.text && (
            <p
              aria-live="polite"
              className={`mt-1 text-sm leading-relaxed ${pulse.status === 'ok' ? 'text-ink-2' : 'text-muted'}`}
            >
              {pulse.text}
            </p>
          )}
          {pulse.status === 'error' && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                {pulse.text ? 'Not updated: ' : 'AI summary unavailable: '}
                {pulse.detail ?? 'unknown error'}
              </span>
            </p>
          )}
          {pulse.data_as_of && (
            <p className="mt-1.5 text-xs text-muted">
              Human edits on all wikis as of {formatTime(pulse.data_as_of)}, whatever the filter
              above. Refreshes about every minute.
            </p>
          )}
        </>
      )
  }
}
