import type { ActivityPoint } from '../types/protocol'

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
const numberFormat = new Intl.NumberFormat()

export const LARGE_REMOVAL_BYTES = 2_000

export function formatTime(iso: string | null): string {
  return iso ? timeFormat.format(new Date(iso)) : '--:--:--'
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function sizeDelta(oldLength: number | null, newLength: number | null): number | null {
  if (newLength === null) return null
  return newLength - (oldLength ?? 0)
}

export function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${numberFormat.format(value)}`
}

export function shortWiki(domain: string): string {
  return domain.replace(/^www\./, '').replace(/\.org$/, '')
}

const BUCKETS_PER_MINUTE = 6

/**
 * Change in edits between the latest minute and the minute before it, from the backend's
 * 10-second activity buckets. Null when there is no complete previous minute to compare.
 */
export function minuteOverMinute(activity: ActivityPoint[]): number | null {
  if (activity.length < BUCKETS_PER_MINUTE * 2) return null
  const total = (points: ActivityPoint[]) => points.reduce((sum, point) => sum + point.edits, 0)
  const latest = total(activity.slice(-BUCKETS_PER_MINUTE))
  const previous = total(activity.slice(-BUCKETS_PER_MINUTE * 2, -BUCKETS_PER_MINUTE))
  if (previous === 0) return null
  return (latest - previous) / previous
}
