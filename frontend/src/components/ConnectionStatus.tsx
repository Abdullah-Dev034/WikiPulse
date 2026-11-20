import type { ConnectionStatus as Connection } from '../hooks/useDashboardSocket'
import { describeConnection } from '../lib/connection'
import type { UpstreamState } from '../types/protocol'
import { StatusDot } from './StatusDot'

interface ConnectionStatusProps {
  connection: Connection
  upstream: UpstreamState
}

export function ConnectionStatus({ connection, upstream }: ConnectionStatusProps) {
  const { tone, label } = describeConnection(connection, upstream)
  return (
    <span
      role="status"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel-raised px-3 text-[13px] font-medium text-ink-2"
    >
      <StatusDot tone={tone} />
      {label}
    </span>
  )
}
