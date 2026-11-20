// Mirrors backend/app/realtime/protocol.py and backend/app/models.py (wire format, snake_case).

export type RiskCategory = 'normal' | 'needs_review' | 'suspicious'
export type UpstreamState = 'connecting' | 'live' | 'reconnecting' | 'replay' | 'stopped'

export interface WikiEvent {
  id: string
  domain: string
  wiki: string
  title: string
  namespace: number | null
  type: 'edit' | 'new'
  user: string
  bot: boolean
  minor: boolean
  timestamp: string
  comment: string
  old_length: number | null
  new_length: number | null
  old_revision: number | null
  new_revision: number | null
  diff_url: string | null
}

export interface RiskSignal {
  code: string
  description: string
  weight: number
}

export interface RiskAssessment {
  score: number
  category: RiskCategory
  signals: RiskSignal[]
  reason: string
}

export interface ScoredEvent {
  event: WikiEvent
  risk: RiskAssessment
}

export interface EventFilter {
  wiki: string | null
  include_bots: boolean
}

export interface PageCount {
  domain: string
  title: string
  edits: number
}

export interface WikiCount {
  domain: string
  edits: number
}

export interface ActivityPoint {
  end: string
  edits: number
}

export interface DashboardStats {
  as_of: string | null
  filter: EventFilter
  edits_last_minute: number
  edits_last_5_minutes: number
  active_wikis: number
  suspicious_last_5_minutes: number
  top_pages: PageCount[]
  activity: ActivityPoint[]
}

export type PulseStatus = 'disabled' | 'pending' | 'ok' | 'error'
export type Verdict = 'likely_vandalism' | 'unclear' | 'likely_fine'

export interface PulseSummary {
  status: PulseStatus
  text: string | null
  generated_at: string | null
  data_as_of: string | null
  model: string | null
  detail: string | null
}

/** Advisory LLM opinion on a rule-flagged edit; never changes the rule-based category. */
export interface AIReview {
  event_id: string
  verdict: Verdict
  reason: string
  model: string
}

export interface Snapshot {
  stats: DashboardStats
  wikis: WikiCount[]
  feed: ScoredEvent[]
  flagged: ScoredEvent[]
  upstream: UpstreamState
  pulse: PulseSummary
  ai_reviews: AIReview[]
}

export type ServerMessage =
  | { type: 'snapshot'; data: Snapshot }
  | { type: 'events'; data: ScoredEvent[] }
  | { type: 'stats'; data: { stats: DashboardStats; wikis: WikiCount[] } }
  | { type: 'status'; data: { state: UpstreamState } }
  | { type: 'pulse'; data: PulseSummary }
  | { type: 'ai_review'; data: AIReview }

export interface SubscribeMessage {
  type: 'subscribe'
  wiki: string | null
  include_bots: boolean
}

const SERVER_MESSAGE_TYPES = new Set([
  'snapshot',
  'events',
  'stats',
  'status',
  'pulse',
  'ai_review',
])

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const message: unknown = JSON.parse(raw)
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      'data' in message &&
      typeof message.type === 'string' &&
      SERVER_MESSAGE_TYPES.has(message.type)
    ) {
      return message as ServerMessage
    }
  } catch {
    // fall through: malformed frames are ignored
  }
  return null
}
