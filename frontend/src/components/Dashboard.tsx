import { useState } from 'react'
import {
  useDashboardSocket,
  type DashboardFilter,
  type SocketFactory,
} from '../hooks/useDashboardSocket'
import { ActivityChart } from './ActivityChart'
import { AIInsightPanel } from './AIInsightPanel'
import { DashboardHeader } from './DashboardHeader'
import { LiveFeed } from './LiveFeed'
import { MetricsRow } from './MetricsRow'
import { TrendingPages } from './TrendingPages'
import { VandalismPanel } from './VandalismPanel'

const DEFAULT_FILTER: DashboardFilter = { wiki: null, includeBots: false }

export function Dashboard({ createSocket }: { createSocket?: SocketFactory }) {
  const [filter, setFilter] = useState<DashboardFilter>(DEFAULT_FILTER)
  const { state, connection } = useDashboardSocket(filter, createSocket)
  const { stats } = state

  return (
    <div className="min-h-screen">
      <DashboardHeader
        filter={filter}
        onFilterChange={setFilter}
        wikis={state.wikis}
        connection={connection}
        upstream={state.upstream}
        asOf={stats?.as_of ?? null}
      />

      <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
        {connection === 'reconnecting' && (
          <p
            role="alert"
            className="rounded-md border border-critical/40 bg-critical/10 px-4 py-2.5 text-sm text-ink"
          >
            Lost connection to the WikiPulse server. Showing the last data received while reconnecting.
          </p>
        )}

        {stats === null ? (
          <p className="py-24 text-center text-sm text-muted">Waiting for the first update…</p>
        ) : (
          <>
            <MetricsRow stats={stats} />
            <AIInsightPanel />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <ActivityChart activity={stats.activity} />
              </div>
              <div className="min-w-0">
                <VandalismPanel items={state.flagged} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="min-w-0">
                <TrendingPages pages={stats.top_pages} />
              </div>
              <div className="min-w-0 lg:col-span-2">
                <LiveFeed items={state.feed} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
