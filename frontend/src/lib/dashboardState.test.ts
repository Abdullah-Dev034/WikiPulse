import { describe, expect, test } from 'vitest'
import { scoredEvent, snapshot, stats } from '../test/fixtures'
import { dashboardReducer, FEED_LIMIT, initialDashboardState } from './dashboardState'

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
})
