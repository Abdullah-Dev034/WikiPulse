import { useEffect, useReducer, useRef, useState } from 'react'
import { dashboardReducer, initialDashboardState, type DashboardState } from '../lib/dashboardState'
import { parseServerMessage, type SubscribeMessage } from '../types/protocol'

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting'

export interface DashboardFilter {
  wiki: string | null
  includeBots: boolean
}

export type SocketFactory = (url: string) => WebSocket

export const INITIAL_RETRY_MS = 1_000
export const MAX_RETRY_MS = 15_000

const browserSocket: SocketFactory = (url) => new WebSocket(url)

export function defaultSocketUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/ws`
}

export function retryDelay(attempt: number): number {
  return Math.min(MAX_RETRY_MS, INITIAL_RETRY_MS * 2 ** attempt)
}

/**
 * One WebSocket for the lifetime of the component. Filter changes are sent as a
 * `subscribe` message on the open socket, never by reconnecting. Drops reconnect with
 * exponential backoff; the server answers every (re)subscribe with a full snapshot.
 */
export function useDashboardSocket(
  filter: DashboardFilter,
  createSocket: SocketFactory = browserSocket,
  url: string = defaultSocketUrl(),
): { state: DashboardState; connection: ConnectionStatus } {
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const socketRef = useRef<WebSocket | null>(null)
  const filterRef = useRef(filter)

  useEffect(() => {
    let attempt = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let disposed = false

    const connect = () => {
      const socket = createSocket(url)
      socketRef.current = socket
      socket.onopen = () => {
        attempt = 0
        setConnection('open')
        socket.send(JSON.stringify(toSubscribe(filterRef.current)))
      }
      socket.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return
        const message = parseServerMessage(event.data)
        if (message) dispatch(message)
      }
      socket.onclose = () => {
        if (disposed) return
        setConnection('reconnecting')
        retryTimer = setTimeout(connect, retryDelay(attempt))
        attempt += 1
      }
      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      disposed = true
      clearTimeout(retryTimer)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [createSocket, url])

  const { wiki, includeBots } = filter
  useEffect(() => {
    filterRef.current = { wiki, includeBots }
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(toSubscribe(filterRef.current)))
    }
  }, [wiki, includeBots])

  return { state, connection }
}

function toSubscribe(filter: DashboardFilter): SubscribeMessage {
  return { type: 'subscribe', wiki: filter.wiki, include_bots: filter.includeBots }
}
