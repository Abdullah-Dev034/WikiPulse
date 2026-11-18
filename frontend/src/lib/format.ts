const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
const numberFormat = new Intl.NumberFormat()

export function formatTime(iso: string | null): string {
  return iso ? timeFormat.format(new Date(iso)) : '--:--:--'
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatSizeDelta(oldLength: number | null, newLength: number | null): string | null {
  if (newLength === null) return null
  const delta = newLength - (oldLength ?? 0)
  return `${delta > 0 ? '+' : ''}${numberFormat.format(delta)}`
}

export function shortWiki(domain: string): string {
  return domain.replace(/\.org$/, '')
}
