import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { FakeSocket, fakeSocketFactory } from '../test/fakeSocket'
import { scoredEvent, snapshot, stats } from '../test/fixtures'
import { Dashboard } from './Dashboard'

function openWith(data = snapshot()) {
  act(() => {
    FakeSocket.latest().serverOpen()
    FakeSocket.latest().serverSend({ type: 'snapshot', data })
  })
}

describe('Dashboard', () => {
  beforeEach(() => FakeSocket.reset())

  test('shows a waiting state before the first snapshot', () => {
    render(<Dashboard createSocket={fakeSocketFactory} />)

    expect(screen.getByText('Waiting for the first update…')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Connecting…')
  })

  test('renders KPIs, trending pages, the live feed and flagged edits from a snapshot', async () => {
    const user = userEvent.setup()
    render(<Dashboard createSocket={fakeSocketFactory} />)
    const flagged = scoredEvent({ id: 'v1', title: 'Blanked page' }, 'suspicious')

    openWith(
      snapshot({
        stats: stats({
          edits_last_minute: 248,
          edits_last_5_minutes: 1203,
          top_pages: [{ domain: 'en.wikipedia.org', title: 'OpenAI', edits: 29 }],
        }),
        feed: [scoredEvent({ title: 'Python (language)' }), flagged],
        flagged: [flagged],
      }),
    )

    expect(screen.getByText('248')).toBeInTheDocument()
    expect(screen.getByText('1,203')).toBeInTheDocument()
    const trending = screen.getByRole('region', { name: 'Trending pages' })
    expect(within(trending).getByRole('link', { name: 'OpenAI' })).toBeInTheDocument()
    const feed = screen.getByRole('region', { name: 'Live feed' })
    expect(within(feed).getByText('Python (language)')).toBeInTheDocument()
    const vandalism = screen.getByRole('region', { name: 'Possible vandalism' })
    expect(within(vandalism).getByText('Suspicious')).toBeInTheDocument()
    expect(within(vandalism).queryByText('Rule-based signals')).not.toBeInTheDocument()

    await user.click(within(vandalism).getByRole('button', { expanded: false }))

    expect(within(vandalism).getByText('Rule-based signals')).toBeInTheDocument()
    expect(within(vandalism).getByText('Removed 4,000 bytes (80% of the page)')).toBeInTheDocument()
  })

  test('new events stream into the feed', () => {
    render(<Dashboard createSocket={fakeSocketFactory} />)
    openWith()

    act(() => FakeSocket.latest().serverSend({ type: 'events', data: [scoredEvent({ title: 'Breaking page' })] }))

    expect(screen.getByText('Breaking page')).toBeInTheDocument()
  })

  test('the wiki filter and bot toggle send subscribe messages', async () => {
    const user = userEvent.setup()
    render(<Dashboard createSocket={fakeSocketFactory} />)
    openWith(snapshot({ wikis: [{ domain: 'de.wikipedia.org', edits: 12 }] }))

    await user.selectOptions(screen.getByRole('combobox'), 'de.wikipedia.org')
    await user.click(screen.getByRole('switch', { name: 'Hide bots' }))

    expect(FakeSocket.instances).toHaveLength(1)
    expect(FakeSocket.latest().sent.slice(-2)).toEqual([
      { type: 'subscribe', wiki: 'de.wikipedia.org', include_bots: false },
      { type: 'subscribe', wiki: 'de.wikipedia.org', include_bots: true },
    ])
  })

  test('shows a banner and keeps the last data while disconnected', () => {
    render(<Dashboard createSocket={fakeSocketFactory} />)
    openWith(snapshot({ stats: stats({ edits_last_minute: 77 }) }))

    act(() => FakeSocket.latest().serverDrop())

    expect(screen.getByRole('alert')).toHaveTextContent('Lost connection')
    expect(screen.getByText('77')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Disconnected, retrying…')
  })

  test('Wikidata entities are labelled as such in trending pages', () => {
    render(<Dashboard createSocket={fakeSocketFactory} />)
    openWith(
      snapshot({
        stats: stats({ top_pages: [{ domain: 'www.wikidata.org', title: 'Q42', edits: 9 }] }),
      }),
    )

    const trending = screen.getByRole('region', { name: 'Trending pages' })
    expect(within(trending).getByRole('link', { name: 'Q42' })).toHaveAttribute(
      'href',
      'https://www.wikidata.org/wiki/Q42',
    )
    expect(within(trending).getByText(/Wikidata item/)).toBeInTheDocument()
  })

  test('feed items expand to show full details', async () => {
    const user = userEvent.setup()
    render(<Dashboard createSocket={fakeSocketFactory} />)
    openWith(snapshot({ feed: [scoredEvent({ title: 'Berlin', comment: 'Fixed a long citation' })] }))
    const feed = screen.getByRole('region', { name: 'Live feed' })

    await user.click(within(feed).getByRole('button', { name: 'Show edit details' }))

    expect(within(feed).getByText('Summary')).toBeInTheDocument()
    expect(within(feed).getByRole('button', { name: 'Hide edit details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  test('markup in edit data is shown as text, never rendered (sample_events.jsonl case)', () => {
    const xss = '<img src=x onerror=alert("xss")> Minor formatting changes.'
    const { container } = render(<Dashboard createSocket={fakeSocketFactory} />)
    openWith(
      snapshot({
        feed: [scoredEvent({ title: '<script>alert(1)</script>', comment: xss })],
        flagged: [scoredEvent({ title: 'Climate change', comment: xss }, 'needs_review')],
      }),
    )

    expect(screen.getAllByText(xss).length).toBeGreaterThan(0)
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('img, script')).toBeNull()
  })

  test('empty panels explain themselves', () => {
    render(<Dashboard createSocket={fakeSocketFactory} />)
    openWith()

    expect(screen.getByText('No edits in this window yet.')).toBeInTheDocument()
    expect(screen.getByText('No edits match the current filter yet.')).toBeInTheDocument()
    expect(screen.getByText('No edits flagged in the last 5 minutes.')).toBeInTheDocument()
  })
})
