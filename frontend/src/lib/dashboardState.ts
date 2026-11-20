import type {
  AIReview,
  DashboardStats,
  PulseSummary,
  ScoredEvent,
  ServerMessage,
  UpstreamState,
  WikiCount,
} from '../types/protocol'

export const FEED_LIMIT = 100
export const FLAGGED_LIMIT = 20
export const AI_REVIEW_LIMIT = 200

const NO_PULSE: PulseSummary = {
  status: 'disabled',
  text: null,
  generated_at: null,
  data_as_of: null,
  model: null,
  detail: null,
}

export interface DashboardState {
  stats: DashboardStats | null
  wikis: WikiCount[]
  feed: ScoredEvent[]
  flagged: ScoredEvent[]
  upstream: UpstreamState
  pulse: PulseSummary
  /** AI second opinions keyed by event id. */
  aiReviews: Record<string, AIReview>
}

export const initialDashboardState: DashboardState = {
  stats: null,
  wikis: [],
  feed: [],
  flagged: [],
  upstream: 'connecting',
  pulse: NO_PULSE,
  aiReviews: {},
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
        pulse: message.data.pulse ?? NO_PULSE,
        // Keep opinions already received: a filter change must not hide them.
        aiReviews: addReviews(state.aiReviews, message.data.ai_reviews ?? []),
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
    case 'pulse':
      return { ...state, pulse: message.data }
    case 'ai_review':
      return { ...state, aiReviews: addReviews(state.aiReviews, [message.data]) }
  }
}

function addReviews(current: Record<string, AIReview>, incoming: AIReview[]): Record<string, AIReview> {
  if (incoming.length === 0) return current
  const merged = { ...current }
  for (const review of incoming) merged[review.event_id] = review
  const ids = Object.keys(merged)
  // Object keys keep insertion order, so the oldest opinions are dropped first.
  for (const id of ids.slice(0, Math.max(0, ids.length - AI_REVIEW_LIMIT))) delete merged[id]
  return merged
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
