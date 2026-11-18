import type { ServerMessage } from '../types/protocol'

/** Minimal stand-in for the browser WebSocket, driven explicitly by tests. */
export class FakeSocket {
  static instances: FakeSocket[] = []

  readyState: number = WebSocket.CONNECTING
  sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }

  static reset(): void {
    FakeSocket.instances = []
  }

  static latest(): FakeSocket {
    const socket = FakeSocket.instances.at(-1)
    if (!socket) throw new Error('no socket created')
    return socket
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  close(): void {
    if (this.readyState === WebSocket.CLOSED) return
    this.readyState = WebSocket.CLOSED
    this.onclose?.()
  }

  serverOpen(): void {
    this.readyState = WebSocket.OPEN
    this.onopen?.()
  }

  serverSend(message: ServerMessage): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }

  serverDrop(): void {
    this.close()
  }
}

export const fakeSocketFactory = (url: string) => new FakeSocket(url) as unknown as WebSocket
