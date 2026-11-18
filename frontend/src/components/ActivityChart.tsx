import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber, formatTime } from '../lib/format'
import type { ActivityPoint } from '../types/protocol'
import { EmptyState, Panel } from './Panel'

interface TooltipProps {
  active?: boolean
  payload?: { payload: ActivityPoint }[]
}

function ActivityTooltip({ active, payload }: TooltipProps) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="rounded-md border border-line bg-panel-raised px-3 py-2 text-xs shadow-lg">
      <p className="text-muted">10 s ending {formatTime(point.end)}</p>
      <p className="font-semibold text-ink">{formatNumber(point.edits)} edits</p>
    </div>
  )
}

const axisTick = { fill: 'var(--color-muted)', fontSize: 11 }

export function ActivityChart({ activity }: { activity: ActivityPoint[] }) {
  return (
    <Panel
      title="Edit activity"
      subtitle="Edits per 10 seconds over the last 5 minutes"
      className="h-full"
    >
      {activity.length === 0 ? (
        <EmptyState>Waiting for edits…</EmptyState>
      ) : (
        <>
          <div className="min-h-56 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: 'var(--color-series)', stopOpacity: 0.35 }} />
                    <stop offset="100%" style={{ stopColor: 'var(--color-series)', stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis
                  dataKey="end"
                  tickFormatter={(value: string) => formatTime(value).slice(0, 5)}
                  interval={5}
                  tick={axisTick}
                  axisLine={{ stroke: 'var(--color-line)' }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip
                  content={<ActivityTooltip />}
                  cursor={{ stroke: 'var(--color-muted)', strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="edits"
                  stroke="var(--color-series)"
                  strokeWidth={2}
                  fill="url(#activity-fill)"
                  dot={false}
                  activeDot={{ r: 4, stroke: 'var(--color-panel)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Edits per 10-second interval</caption>
            <thead>
              <tr>
                <th>Interval ending</th>
                <th>Edits</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((point) => (
                <tr key={point.end}>
                  <td>{formatTime(point.end)}</td>
                  <td>{point.edits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  )
}
