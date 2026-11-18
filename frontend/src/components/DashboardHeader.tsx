import { Activity } from 'lucide-react'
import type { ConnectionStatus as Connection, DashboardFilter } from '../hooks/useDashboardSocket'
import { formatTime } from '../lib/format'
import type { UpstreamState, WikiCount } from '../types/protocol'
import { ConnectionStatus } from './ConnectionStatus'
import { WikiFilter } from './WikiFilter'

interface DashboardHeaderProps {
  filter: DashboardFilter
  onFilterChange: (filter: DashboardFilter) => void
  wikis: WikiCount[]
  connection: Connection
  upstream: UpstreamState
  asOf: string | null
}

export function DashboardHeader({
  filter,
  onFilterChange,
  wikis,
  connection,
  upstream,
  asOf,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-md bg-accent text-accent-ink"
            >
              <Activity className="size-5" strokeWidth={2.5} />
            </span>
            <div>
              <h1 className="text-base leading-tight font-semibold">WikiPulse</h1>
              <p className="text-xs text-muted">Real-time Wikipedia monitoring</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center justify-between gap-3">
            <ConnectionStatus connection={connection} upstream={upstream} />
            <p className="text-xs text-muted sm:hidden">
              Updated <time dateTime={asOf ?? undefined}>{formatTime(asOf)}</time>
            </p>
          </div>
          <WikiFilter filter={filter} wikis={wikis} onChange={onFilterChange} />
          <p className="hidden text-[13px] text-muted sm:block">
            Updated <time dateTime={asOf ?? undefined}>{formatTime(asOf)}</time>
          </p>
        </div>
      </div>
    </header>
  )
}
