import type { StatusTone } from '../components/StatusDot'
import type { ConnectionStatus } from '../hooks/useDashboardSocket'
import type { UpstreamState } from '../types/protocol'

export function describeConnection(
  connection: ConnectionStatus,
  upstream: UpstreamState,
): { tone: StatusTone; label: string } {
  if (connection === 'connecting') return { tone: 'neutral', label: 'Connecting…' }
  if (connection === 'reconnecting') return { tone: 'critical', label: 'Disconnected, retrying…' }
  switch (upstream) {
    case 'live':
      return { tone: 'good', label: 'Live' }
    case 'replay':
      return { tone: 'neutral', label: 'Replay (recorded data)' }
    case 'reconnecting':
      return { tone: 'warning', label: 'Wikimedia stream reconnecting' }
    case 'stopped':
      return { tone: 'serious', label: 'Stream stopped' }
    case 'connecting':
      return { tone: 'neutral', label: 'Connecting to Wikimedia…' }
  }
}
