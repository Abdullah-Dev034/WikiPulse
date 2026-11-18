import type { ConnectionStatus } from '../hooks/useDashboardSocket'
import { describeConnection } from '../lib/connection'
import type { UpstreamState } from '../types/protocol'
import { StatusDot } from './StatusDot'

interface ConnectionBadgeProps {
  connection: ConnectionStatus
  upstream: UpstreamState
}

export function ConnectionBadge({ connection, upstream }: ConnectionBadgeProps) {
  const { tone, label } = describeConnection(connection, upstream)
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 shadow-sm text-xs text-ink-2"
    >
      <StatusDot tone={tone} />
      {label}
    </span>
  )
}
