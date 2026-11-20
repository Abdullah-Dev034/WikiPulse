import { ChevronDown, ExternalLink } from 'lucide-react'
import { memo, useState } from 'react'
import { formatNumber, formatSigned, formatTime, LARGE_REMOVAL_BYTES, shortWiki, sizeDelta } from '../lib/format'
import { describePage } from '../lib/pages'
import type { ScoredEvent } from '../types/protocol'
import { RiskBadge } from './RiskBadge'

function Tag({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded bg-panel-raised px-1.5 py-px text-[11px] font-medium whitespace-nowrap text-ink-2">
      {children}
    </span>
  )
}

function SizeChange({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const tone =
    delta > 0 ? 'text-good' : delta <= -LARGE_REMOVAL_BYTES ? 'text-critical' : delta < 0 ? 'text-ink-2' : 'text-muted'
  return (
    <span className={`shrink-0 text-xs font-semibold tabular-nums ${tone}`} title="Change in page size (bytes)">
      {formatSigned(delta)}
    </span>
  )
}

export const LiveFeedItem = memo(function LiveFeedItem({ item }: { item: ScoredEvent }) {
  const { event, risk } = item
  const [open, setOpen] = useState(false)
  const page = describePage(event.domain, event.title)
  const delta = sizeDelta(event.old_length, event.new_length)
  const detailsId = `edit-${event.id}`

  return (
    <li className="animate-enter">
      <div className="flex items-start gap-3 py-2.5">
        <time className="hidden w-[5.25rem] shrink-0 pt-0.5 text-xs whitespace-nowrap text-muted tabular-nums sm:block" dateTime={event.timestamp}>
          {formatTime(event.timestamp)}
        </time>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={event.diff_url ?? page.url}
              target="_blank"
              rel="noreferrer"
              title={event.title}
              className="min-w-0 truncate text-sm font-medium text-ink hover:underline"
            >
              {page.name}
            </a>
            <RiskBadge risk={risk} />
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted sm:flex-nowrap">
            <time className="shrink-0 tabular-nums sm:hidden" dateTime={event.timestamp}>
              {formatTime(event.timestamp)}
            </time>
            <span className="shrink-0">{shortWiki(event.domain)}</span>
            <span className="max-w-40 shrink-0 truncate">{event.user || 'hidden user'}</span>
            {page.kind && <Tag>{page.kind}</Tag>}
            {event.type === 'new' && <Tag>new page</Tag>}
            {event.bot && <Tag>bot</Tag>}
            {event.minor && <Tag>minor</Tag>}
            {event.comment && (
              <span className="min-w-0 basis-full truncate sm:basis-auto">{event.comment}</span>
            )}
          </div>
        </div>
        <SizeChange delta={delta} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={open ? 'Hide edit details' : 'Show edit details'}
          onClick={() => setOpen((value) => !value)}
          className="-m-1 shrink-0 rounded p-1 text-muted outline-none hover:bg-panel-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <dl
          id={detailsId}
          className="mb-3 grid sm:ml-[6rem] grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-md bg-panel-raised/50 p-3 text-xs"
        >
          <dt className="text-muted">Page</dt>
          <dd className="break-words text-ink-2">{event.title}</dd>
          <dt className="text-muted">Summary</dt>
          <dd className="break-words text-ink-2">{event.comment || 'No edit summary'}</dd>
          <dt className="text-muted">Editor</dt>
          <dd className="break-words text-ink-2">{event.user || 'hidden user'}</dd>
          {event.new_length !== null && (
            <>
              <dt className="text-muted">Size</dt>
              <dd className="text-ink-2">
                {event.old_length === null ? 'new page' : `${formatNumber(event.old_length)} →`}{' '}
                {formatNumber(event.new_length)} bytes
              </dd>
            </>
          )}
          {risk.category !== 'normal' && (
            <>
              <dt className="text-muted">Risk</dt>
              <dd className="text-ink-2">{risk.reason}</dd>
            </>
          )}
          <dt className="sr-only">Links</dt>
          <dd className="col-span-2 mt-1 flex flex-wrap gap-4">
            {event.diff_url && (
              <a href={event.diff_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                View diff <ExternalLink aria-hidden className="size-3" />
              </a>
            )}
            <a href={page.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Open page <ExternalLink aria-hidden className="size-3" />
            </a>
          </dd>
        </dl>
      )}
    </li>
  )
})
