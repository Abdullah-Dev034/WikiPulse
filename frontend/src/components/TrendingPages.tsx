import { formatNumber, shortWiki } from '../lib/format'
import { describePage } from '../lib/pages'
import type { PageCount } from '../types/protocol'
import { EmptyState, Panel } from './Panel'

function TrendingPageItem({ page, rank, max }: { page: PageCount; rank: number; max: number }) {
  const label = describePage(page.domain, page.title)
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2">
      <span className="text-right text-xs font-semibold text-muted">{rank}</span>
      <div className="min-w-0">
        <a
          href={label.url}
          target="_blank"
          rel="noreferrer"
          title={page.title}
          className="block truncate text-sm font-medium text-ink hover:underline"
        >
          {label.name}
        </a>
        <p className="truncate text-xs text-muted">
          {shortWiki(page.domain)}
          {label.kind && <> · {label.kind}</>}
        </p>
      </div>
      <span className="text-sm font-semibold text-ink tabular-nums">{formatNumber(page.edits)}</span>
      <div className="col-start-2 col-end-4 h-1 rounded-full bg-panel-raised">
        <div
          className="h-full rounded-full bg-accent/80"
          style={{ width: `${Math.max(4, (page.edits / max) * 100)}%` }}
        />
      </div>
    </li>
  )
}

export function TrendingPages({ pages }: { pages: PageCount[] }) {
  const max = Math.max(1, ...pages.map((page) => page.edits))
  return (
    <Panel title="Trending pages" subtitle="Most-edited pages, last 5 minutes" className="h-full">
      {pages.length === 0 ? (
        <EmptyState>No edits in this window yet.</EmptyState>
      ) : (
        <ol className="divide-y divide-line/60">
          {pages.map((page, index) => (
            <TrendingPageItem key={`${page.domain}|${page.title}`} page={page} rank={index + 1} max={max} />
          ))}
        </ol>
      )}
    </Panel>
  )
}
