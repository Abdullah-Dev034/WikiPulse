import { formatNumber, shortWiki } from '../lib/format'
import type { PageCount } from '../types/protocol'
import { EmptyState, Panel } from './Panel'

function pageUrl(page: PageCount): string {
  return `https://${page.domain}/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`
}

export function TrendingPages({ pages }: { pages: PageCount[] }) {
  const max = Math.max(1, ...pages.map((page) => page.edits))
  return (
    <Panel title="Trending pages" subtitle="Top 10 most-edited pages, last 5 minutes">
      {pages.length === 0 ? (
        <EmptyState>No edits in this window yet.</EmptyState>
      ) : (
        <ol className="space-y-2">
          {pages.map((page, index) => (
            <li key={`${page.domain}|${page.title}`} title={`${page.title}: ${page.edits} edits`}>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="w-5 shrink-0 text-right text-xs text-muted">{index + 1}</span>
                <a
                  href={pageUrl(page)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-ink hover:underline"
                >
                  {page.title}
                </a>
                <span className="shrink-0 text-xs text-muted">{shortWiki(page.domain)}</span>
                <span className="w-8 shrink-0 text-right font-medium">
                  {formatNumber(page.edits)}
                </span>
              </div>
              <div className="ml-7 mt-1 h-1.5 rounded-full bg-panel-raised">
                <div
                  className="h-full rounded-full bg-series"
                  style={{ width: `${(page.edits / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
