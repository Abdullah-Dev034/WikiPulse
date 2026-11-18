import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
    <Panel title="Edit activity" subtitle="Edits per 10 seconds over the last 5 minutes">
      {activity.length === 0 ? (
        <EmptyState>Waiting for edits…</EmptyState>
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activity}
                barCategoryGap={2}
                margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
              >
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
                  cursor={{ fill: 'var(--color-panel-raised)' }}
                />
                <Bar
                  dataKey="edits"
                  fill="var(--color-series)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
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
