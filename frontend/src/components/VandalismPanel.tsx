import { Info } from 'lucide-react'
import type { AIReview, ScoredEvent } from '../types/protocol'
import { EmptyState, Panel, Pill } from './Panel'
import { VandalismAlert } from './VandalismAlert'

export function VandalismPanel({
  items,
  reviews = {},
}: {
  items: ScoredEvent[]
  reviews?: Record<string, AIReview>
}) {
  return (
    <Panel
      title="Possible vandalism"
      subtitle="Edits matching metadata risk signals"
      actions={items.length > 0 && <Pill>{items.length} recent</Pill>}
      className="h-full"
    >
      {items.length === 0 ? (
        <EmptyState>No edits flagged in the last 5 minutes.</EmptyState>
      ) : (
        <ul className="-mx-1 max-h-[22rem] min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
          {items.map((item) => (
            <VandalismAlert key={item.event.id} item={item} review={reviews[item.event.id]} />
          ))}
        </ul>
      )}
      <p className="mt-3 flex gap-2 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Scored from edit metadata only (size change, summary, editor type, timing). Diffs are not
        analysed, so a flag means an edit is worth a look, not that it is vandalism.
      </p>
    </Panel>
  )
}
