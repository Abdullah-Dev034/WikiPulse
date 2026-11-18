import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FakeSocket, fakeSocketFactory } from '../test/fakeSocket'
import { snapshot } from '../test/fixtures'
import { INITIAL_RETRY_MS, retryDelay, useDashboardSocket, type DashboardFilter } from './useDashboardSocket'

const ALL: DashboardFilter = { wiki: null, includeBots: false }

function render(filter: DashboardFilter = ALL) {
  return renderHook(({ current }) => useDashboardSocket(current, fakeSocketFactory, 'ws://test/ws'), {
    initialProps: { current: filter },
  })
}

describe('useDashboardSocket', () => {
  beforeEach(() => {
    FakeSocket.reset()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  test('subscribes with the current filter once the socket opens', () => {
    const { result } = render()
    expect(result.current.connection).toBe('connecting')

    act(() => FakeSocket.latest().serverOpen())

    expect(result.current.connection).toBe('open')
    expect(FakeSocket.latest().sent).toEqual([{ type: 'subscribe', wiki: null, include_bots: false }])
  })

  test('changing the filter re-subscribes on the same socket', () => {
    const { rerender } = render()
    act(() => FakeSocket.latest().serverOpen())

    rerender({ current: { wiki: 'de.wikipedia.org', includeBots: true } })

    expect(FakeSocket.instances).toHaveLength(1)
    expect(FakeSocket.latest().sent.at(-1)).toEqual({
      type: 'subscribe',
      wiki: 'de.wikipedia.org',
      include_bots: true,
    })
  })

  test('server messages update the dashboard state', () => {
    const { result } = render()
    act(() => {
      FakeSocket.latest().serverOpen()
      FakeSocket.latest().serverSend({ type: 'snapshot', data: snapshot({ upstream: 'live' }) })
    })

    expect(result.current.state.upstream).toBe('live')
    expect(result.current.state.stats).not.toBeNull()
  })

  test('reconnects with backoff after a drop and resubscribes', () => {
    const { result, rerender } = render()
    act(() => FakeSocket.latest().serverOpen())
    rerender({ current: { wiki: 'fr.wikipedia.org', includeBots: false } })

    act(() => FakeSocket.latest().serverDrop())
    expect(result.current.connection).toBe('reconnecting')
    expect(FakeSocket.instances).toHaveLength(1)

    act(() => vi.advanceTimersByTime(INITIAL_RETRY_MS))
    expect(FakeSocket.instances).toHaveLength(2)

    act(() => FakeSocket.latest().serverOpen())
    expect(result.current.connection).toBe('open')
    expect(FakeSocket.latest().sent).toEqual([
      { type: 'subscribe', wiki: 'fr.wikipedia.org', include_bots: false },
    ])
  })

  test('unmounting closes the socket and stops reconnecting', () => {
    const { unmount } = render()
    const socket = FakeSocket.latest()

    unmount()
    act(() => vi.advanceTimersByTime(60_000))

    expect(socket.readyState).toBe(WebSocket.CLOSED)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  test('backoff doubles and is capped', () => {
    expect([0, 1, 2, 3, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 15000])
  })
})
