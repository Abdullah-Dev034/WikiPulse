import { useState } from 'react'
import {
  useDashboardSocket,
  type DashboardFilter,
  type SocketFactory,
} from '../hooks/useDashboardSocket'
import { ActivityChart } from './ActivityChart'
import { EditFeed } from './EditFeed'
import { FlaggedEdits } from './FlaggedEdits'
import { Header } from './Header'
import { KpiCards } from './KpiCards'
import { TrendingPages } from './TrendingPages'

const DEFAULT_FILTER: DashboardFilter = { wiki: null, includeBots: false }

export function Dashboard({ createSocket }: { createSocket?: SocketFactory }) {
  const [filter, setFilter] = useState<DashboardFilter>(DEFAULT_FILTER)
  const { state, connection } = useDashboardSocket(filter, createSocket)
  const { stats } = state

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <Header
        filter={filter}
        onFilterChange={setFilter}
        wikis={state.wikis}
        connection={connection}
        upstream={state.upstream}
        asOf={stats?.as_of ?? null}
      />

      {connection === 'reconnecting' && (
        <p role="alert" className="rounded-lg border border-critical/50 bg-critical/10 px-4 py-2 text-sm">
          Lost connection to the WikiPulse server. Showing the last data received while reconnecting.
        </p>
      )}

      {stats === null ? (
        <p className="py-24 text-center text-sm text-muted">Waiting for the first update…</p>
      ) : (
        <>
          <KpiCards stats={stats} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <ActivityChart activity={stats.activity} />
            </div>
            <FlaggedEdits items={state.flagged} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TrendingPages pages={stats.top_pages} />
            <div className="min-w-0 lg:col-span-2">
              <EditFeed items={state.feed} />
            </div>
          </div>
        </>
      )}
    </main>
  )
}
