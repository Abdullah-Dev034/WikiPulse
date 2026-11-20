import { describe, expect, test } from 'vitest'
import { pulse, scoredEvent, snapshot, stats } from '../test/fixtures'
import { AI_REVIEW_LIMIT, dashboardReducer, FEED_LIMIT, initialDashboardState } from './dashboardState'

describe('dashboardReducer', () => {
  test('snapshot replaces the whole state', () => {
    const before = dashboardReducer(initialDashboardState, {
      type: 'events',
      data: [scoredEvent({ id: 'old' })],
    })

    const after = dashboardReducer(before, {
      type: 'snapshot',
      data: snapshot({ feed: [scoredEvent({ id: 'fresh' })], upstream: 'live' }),
    })

    expect(after.feed.map((item) => item.event.id)).toEqual(['fresh'])
    expect(after.upstream).toBe('live')
  })

  test('events are shown newest first and duplicates are dropped', () => {
    const state = dashboardReducer(
      { ...initialDashboardState, feed: [scoredEvent({ id: 'a' })] },
      { type: 'events', data: [scoredEvent({ id: 'a' }), scoredEvent({ id: 'b' }), scoredEvent({ id: 'c' })] },
    )

    expect(state.feed.map((item) => item.event.id)).toEqual(['c', 'b', 'a'])
  })

  test('the feed never grows past its limit', () => {
    const many = Array.from({ length: FEED_LIMIT + 25 }, (_, index) => scoredEvent({ id: `e${index}` }))

    const state = dashboardReducer(initialDashboardState, { type: 'events', data: many })

    expect(state.feed).toHaveLength(FEED_LIMIT)
    expect(state.feed[0].event.id).toBe(`e${FEED_LIMIT + 24}`)
  })

  test('flagged edits are collected separately', () => {
    const state = dashboardReducer(initialDashboardState, {
      type: 'events',
      data: [scoredEvent({ id: 'ok' }), scoredEvent({ id: 'bad' }, 'suspicious')],
    })

    expect(state.flagged.map((item) => item.event.id)).toEqual(['bad'])
  })

  test('stats and status messages update only their part', () => {
    const withStats = dashboardReducer(initialDashboardState, {
      type: 'stats',
      data: { stats: stats({ edits_last_minute: 42 }), wikis: [{ domain: 'de.wikipedia.org', edits: 3 }] },
    })
    const withStatus = dashboardReducer(withStats, { type: 'status', data: { state: 'reconnecting' } })

    expect(withStatus.stats?.edits_last_minute).toBe(42)
    expect(withStatus.wikis).toHaveLength(1)
    expect(withStatus.upstream).toBe('reconnecting')
  })

  test('pulse updates replace the summary', () => {
    const state = dashboardReducer(initialDashboardState, {
      type: 'pulse',
      data: pulse({ status: 'ok', text: 'Quiet hour.', model: 'm' }),
    })

    expect(state.pulse.text).toBe('Quiet hour.')
  })

  test('AI reviews accumulate by event id, survive snapshots and stay bounded', () => {
    const review = (id: string) => ({ event_id: id, verdict: 'unclear' as const, reason: 'r', model: 'm' })
    let state = dashboardReducer(initialDashboardState, { type: 'ai_review', data: review('a') })
    state = dashboardReducer(state, { type: 'snapshot', data: snapshot({ ai_reviews: [review('b')] }) })

    expect(Object.keys(state.aiReviews)).toEqual(['a', 'b'])

    for (let n = 0; n < AI_REVIEW_LIMIT + 5; n++) {
      state = dashboardReducer(state, { type: 'ai_review', data: review(`x${n}`) })
    }
    expect(Object.keys(state.aiReviews)).toHaveLength(AI_REVIEW_LIMIT)
    expect(state.aiReviews.a).toBeUndefined()
  })
})
