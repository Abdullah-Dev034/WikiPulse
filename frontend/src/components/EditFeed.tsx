// Interim live feed. To be reconciled with the provided LiveFeed.tsx starter once received.
import { formatSizeDelta, formatTime, shortWiki } from '../lib/format'
import type { ScoredEvent } from '../types/protocol'
import { EmptyState, Panel } from './Panel'
import { RiskBadge } from './RiskBadge'

function Tag({ children }: { children: string }) {
  return <span className="rounded border border-line px-1.5 text-[11px] text-muted">{children}</span>
}

export function EditFeed({ items }: { items: ScoredEvent[] }) {
  return (
    <Panel title="Live feed" subtitle="Most recent edits, newest first" className="h-full">
      {items.length === 0 ? (
        <EmptyState>No edits match the current filter yet.</EmptyState>
      ) : (
        <ul className="-mx-2 max-h-[28rem] divide-y divide-line overflow-y-auto">
          {items.map(({ event, risk }) => {
            const delta = formatSizeDelta(event.old_length, event.new_length)
            return (
              <li key={event.id} className="px-2 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <time className="shrink-0 text-xs text-muted" dateTime={event.timestamp}>
                    {formatTime(event.timestamp)}
                  </time>
                  <a
                    href={event.diff_url ?? `https://${event.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate font-semibold text-ink hover:underline"
                  >
                    {event.title}
                  </a>
                  <RiskBadge risk={risk} />
                  {delta && <span className="shrink-0 text-xs text-ink-2">{delta}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{shortWiki(event.domain)}</span>
                  <span className="max-w-48 truncate">{event.user || 'hidden user'}</span>
                  {event.type === 'new' && <Tag>new page</Tag>}
                  {event.bot && <Tag>bot</Tag>}
                  {event.minor && <Tag>minor</Tag>}
                  {event.comment && <span className="min-w-0 flex-1 truncate">{event.comment}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
