// Interim live feed. To be reconciled with the provided LiveFeed.tsx starter once received.
import type { ScoredEvent } from '../types/protocol'
import { LiveFeedItem } from './LiveFeedItem'
import { EmptyState, Panel, Pill } from './Panel'

export function LiveFeed({ items }: { items: ScoredEvent[] }) {
  return (
    <Panel
      title="Live feed"
      subtitle="Newest edits first"
      actions={items.length > 0 && <Pill>{items.length} shown</Pill>}
      className="h-full"
    >
      {items.length === 0 ? (
        <EmptyState>No edits match the current filter yet.</EmptyState>
      ) : (
        <ul className="-mr-2 max-h-[34rem] min-h-0 flex-1 divide-y lg:h-0 lg:max-h-none divide-line/60 overflow-x-hidden overflow-y-auto pr-2">
          {items.map((item) => (
            <LiveFeedItem key={item.event.id} item={item} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
