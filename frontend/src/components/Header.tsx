import type { ConnectionStatus, DashboardFilter } from '../hooks/useDashboardSocket'
import { formatNumber, formatTime } from '../lib/format'
import type { UpstreamState, WikiCount } from '../types/protocol'
import { ConnectionBadge } from './ConnectionBadge'

interface HeaderProps {
  filter: DashboardFilter
  onFilterChange: (filter: DashboardFilter) => void
  wikis: WikiCount[]
  connection: ConnectionStatus
  upstream: UpstreamState
  asOf: string | null
}

export function Header({ filter, onFilterChange, wikis, connection, upstream, asOf }: HeaderProps) {
  const options =
    filter.wiki && !wikis.some((wiki) => wiki.domain === filter.wiki)
      ? [{ domain: filter.wiki, edits: 0 }, ...wikis]
      : wikis

  return (
    <header className="flex flex-col gap-4 border-b border-line pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div aria-hidden className="grid size-9 place-items-center rounded-lg bg-accent font-bold text-white">
          W
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight text-brand">WikiPulse</h1>
          <p className="text-xs text-muted">Live Wikipedia edit monitor</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <ConnectionBadge connection={connection} upstream={upstream} />
        <label className="flex items-center gap-2 text-ink-2">
          <span className="sr-only sm:not-sr-only">Wiki</span>
          <select
            value={filter.wiki ?? ''}
            onChange={(event) => onFilterChange({ ...filter, wiki: event.target.value || null })}
            className="max-w-56 rounded-lg border border-line bg-panel px-2 py-1.5 text-ink shadow-sm"
          >
            <option value="">All wikis</option>
            {options.map((wiki) => (
              <option key={wiki.domain} value={wiki.domain}>
                {wiki.domain} ({formatNumber(wiki.edits)})
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-ink-2">
          <input
            type="checkbox"
            checked={!filter.includeBots}
            onChange={(event) => onFilterChange({ ...filter, includeBots: !event.target.checked })}
            className="size-4 accent-accent"
          />
          Hide bots
        </label>
        <span className="text-xs text-muted">Data as of {formatTime(asOf)}</span>
      </div>
    </header>
  )
}
