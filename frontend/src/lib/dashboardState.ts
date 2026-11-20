import type {
  DashboardStats,
  ScoredEvent,
  ServerMessage,
  UpstreamState,
  WikiCount,
} from '../types/protocol'

export const FEED_LIMIT = 100
export const FLAGGED_LIMIT = 20

export interface DashboardState {
  stats: DashboardStats | null
  wikis: WikiCount[]
  feed: ScoredEvent[]
  flagged: ScoredEvent[]
  upstream: UpstreamState
}

export const initialDashboardState: DashboardState = {
  stats: null,
  wikis: [],
  feed: [],
  flagged: [],
  upstream: 'connecting',
}

export function dashboardReducer(state: DashboardState, message: ServerMessage): DashboardState {
  switch (message.type) {
    case 'snapshot':
      return {
        stats: message.data.stats,
        wikis: message.data.wikis,
        feed: message.data.feed.slice(0, FEED_LIMIT),
        flagged: message.data.flagged.slice(0, FLAGGED_LIMIT),
        upstream: message.data.upstream,
      }
    case 'events': {
      const newestFirst = [...message.data].reverse()
      const flagged = newestFirst.filter((item) => item.risk.category !== 'normal')
      return {
        ...state,
        feed: prependUnique(state.feed, newestFirst, FEED_LIMIT),
        flagged: flagged.length ? prependUnique(state.flagged, flagged, FLAGGED_LIMIT) : state.flagged,
      }
    }
    case 'stats':
      return { ...state, stats: message.data.stats, wikis: message.data.wikis }
    case 'status':
      return { ...state, upstream: message.data.state }
  }
}

/** Newest items first, dropping any id already shown, capped at `limit`. */
function prependUnique(current: ScoredEvent[], incoming: ScoredEvent[], limit: number): ScoredEvent[] {
  const seen = new Set(current.map((item) => item.event.id))
  const fresh = incoming.filter((item) => {
    if (seen.has(item.event.id)) return false
    seen.add(item.event.id)
    return true
  })
  return fresh.length ? [...fresh, ...current].slice(0, limit) : current
}
