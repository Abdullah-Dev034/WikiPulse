import { describe, expect, test } from 'vitest'
import type { ActivityPoint } from '../types/protocol'
import { minuteOverMinute, shortWiki, sizeDelta } from './format'
import { describePage } from './pages'

function buckets(...edits: number[]): ActivityPoint[] {
  return edits.map((count, index) => ({ end: `2026-11-18T12:00:${String(index).padStart(2, '0')}Z`, edits: count }))
}

describe('describePage', () => {
  test('shows Wikidata entity ids with their kind instead of treating them as articles', () => {
    expect(describePage('www.wikidata.org', 'Q42')).toMatchObject({ name: 'Q42', kind: 'Wikidata item' })
    expect(describePage('www.wikidata.org', 'Property:P31')).toMatchObject({
      name: 'P31',
      kind: 'Wikidata property',
    })
    expect(describePage('www.wikidata.org', 'Lexeme:L57430').kind).toBe('Wikidata lexeme')
  })

  test('a Q-prefixed title on Wikipedia is an ordinary article', () => {
    expect(describePage('en.wikipedia.org', 'Q (James Bond)')).toMatchObject({
      name: 'Q (James Bond)',
      kind: null,
    })
  })

  test('namespaced titles get a badge; other colons stay in the name', () => {
    expect(describePage('commons.wikimedia.org', 'File:Cat.jpg')).toMatchObject({ name: 'Cat.jpg', kind: 'File' })
    expect(describePage('en.wikipedia.org', 'Star Wars: A New Hope')).toMatchObject({
      name: 'Star Wars: A New Hope',
      kind: null,
    })
  })
})

describe('minuteOverMinute', () => {
  test('compares the latest six 10-second buckets with the six before', () => {
    expect(minuteOverMinute(buckets(10, 10, 10, 10, 10, 10, 15, 15, 15, 15, 15, 15))).toBeCloseTo(0.5)
  })

  test('returns null without a complete, non-empty previous minute', () => {
    expect(minuteOverMinute(buckets(1, 2, 3))).toBeNull()
    expect(minuteOverMinute(buckets(0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5))).toBeNull()
  })
})

test('sizeDelta treats a missing old length as a new page', () => {
  expect(sizeDelta(null, 300)).toBe(300)
  expect(sizeDelta(1000, 400)).toBe(-600)
  expect(sizeDelta(1000, null)).toBeNull()
})

test('shortWiki drops www. and .org', () => {
  expect(shortWiki('www.wikidata.org')).toBe('wikidata')
  expect(shortWiki('en.wikipedia.org')).toBe('en.wikipedia')
})
