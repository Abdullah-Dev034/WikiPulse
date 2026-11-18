import { formatTime, shortWiki } from '../lib/format'
import type { ScoredEvent } from '../types/protocol'
import { EmptyState, Panel } from './Panel'
import { RiskBadge } from './RiskBadge'

export function FlaggedEdits({ items }: { items: ScoredEvent[] }) {
  return (
    <Panel title="Possible vandalism" subtitle="Edits whose metadata matches risk signals">
      {items.length === 0 ? (
        <EmptyState>No edits flagged in the last 5 minutes.</EmptyState>
      ) : (
        <ul className="-mx-2 max-h-80 space-y-1 overflow-y-auto">
          {items.map(({ event, risk }) => (
            <li key={event.id} className="rounded-lg px-2 py-2 hover:bg-panel-raised">
              <div className="flex items-center gap-2 text-sm">
                <RiskBadge risk={risk} />
                <a
                  href={event.diff_url ?? `https://${event.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {event.title}
                </a>
              </div>
              <p className="mt-1 text-xs text-ink-2">{risk.reason}</p>
              <p className="mt-0.5 text-xs text-muted">
                {shortWiki(event.domain)} · {event.user || 'hidden user'} ·{' '}
                {formatTime(event.timestamp)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-line pt-2 text-[11px] leading-snug text-muted">
        Based on edit metadata only (size change, summary, editor type, timing). Diffs are not
        analysed, so a flag means it is worth a look, not that it is vandalism.
      </p>
    </Panel>
  )
}
