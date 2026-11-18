import type {
  DashboardStats,
  RiskCategory,
  ScoredEvent,
  Snapshot,
} from '../types/protocol'

let nextId = 1

export function scoredEvent(
  overrides: Partial<ScoredEvent['event']> = {},
  category: RiskCategory = 'normal',
): ScoredEvent {
  const id = overrides.id ?? `evt-${nextId++}`
  return {
    event: {
      id,
      domain: 'en.wikipedia.org',
      wiki: 'enwiki',
      title: `Page ${id}`,
      namespace: 0,
      type: 'edit',
      user: 'Alice',
      bot: false,
      minor: false,
      timestamp: '2026-11-18T12:00:00Z',
      comment: 'copyedit',
      old_length: 1000,
      new_length: 1050,
      old_revision: 1,
      new_revision: 2,
      diff_url: null,
      ...overrides,
    },
    risk: {
      score: category === 'normal' ? 0 : 65,
      category,
      signals: [],
      reason: category === 'normal' ? '' : 'Removed 4,000 bytes (80% of the page)',
    },
  }
}

export function stats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    as_of: '2026-11-18T12:00:00Z',
    filter: { wiki: null, include_bots: false },
    edits_last_minute: 0,
    edits_last_5_minutes: 0,
    active_wikis: 0,
    suspicious_last_5_minutes: 0,
    top_pages: [],
    activity: [],
    ...overrides,
  }
}

export function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return { stats: stats(), wikis: [], feed: [], flagged: [], upstream: 'replay', ...overrides }
}
