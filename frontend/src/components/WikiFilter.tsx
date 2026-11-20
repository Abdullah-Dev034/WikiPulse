import { ChevronDown } from 'lucide-react'
import type { DashboardFilter } from '../hooks/useDashboardSocket'
import { formatNumber } from '../lib/format'
import type { WikiCount } from '../types/protocol'

interface WikiFilterProps {
  filter: DashboardFilter
  wikis: WikiCount[]
  onChange: (filter: DashboardFilter) => void
}

export function WikiFilter({ filter, wikis, onChange }: WikiFilterProps) {
  const options =
    filter.wiki && !wikis.some((wiki) => wiki.domain === filter.wiki)
      ? [{ domain: filter.wiki, edits: 0 }, ...wikis]
      : wikis

  return (
    <div className="flex min-w-0 items-center gap-3">
      <label className="relative min-w-0 flex-1 sm:flex-none">
        <span className="sr-only">Wiki</span>
        <select
          value={filter.wiki ?? ''}
          onChange={(event) => onChange({ ...filter, wiki: event.target.value || null })}
          className="h-9 w-full appearance-none truncate rounded-md border border-line bg-panel-raised pr-9 pl-3 text-[13px] font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64"
        >
          <option value="">All wikis</option>
          {options.map((wiki) => (
            <option key={wiki.domain} value={wiki.domain}>
              {wiki.domain} ({formatNumber(wiki.edits)})
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        />
      </label>

      <button
        type="button"
        role="switch"
        aria-checked={!filter.includeBots}
        onClick={() => onChange({ ...filter, includeBots: !filter.includeBots })}
        className="flex h-9 shrink-0 items-center gap-2 rounded-md px-1 text-[13px] font-medium text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden
          className={`relative h-5 w-9 rounded-full transition-colors ${filter.includeBots ? 'bg-line' : 'bg-accent'}`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full transition-transform ${filter.includeBots ? 'left-0.5 bg-muted' : 'left-0.5 translate-x-4 bg-accent-ink'}`}
          />
        </span>
        Hide bots
      </button>
    </div>
  )
}
