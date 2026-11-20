export interface PageLabel {
  /** Text to show as the page name. */
  name: string
  /** Short kind badge, e.g. "Wikidata item", "File", "Talk"; null for ordinary articles. */
  kind: string | null
  url: string
}

const WIKIDATA_DOMAIN = 'www.wikidata.org'
const WIKIDATA_ENTITY = /^(?:(?:Property|Lexeme):)?([QPL])(\d+)$/
const WIKIDATA_KINDS: Record<string, string> = {
  Q: 'Wikidata item',
  P: 'Wikidata property',
  L: 'Wikidata lexeme',
}
const NAMESPACES = new Set([
  'Talk',
  'User',
  'User talk',
  'Wikipedia',
  'Wikipedia talk',
  'File',
  'Category',
  'Template',
  'Help',
  'Portal',
  'Module',
  'Draft',
  'Project',
  'Commons',
])

export function pageUrl(domain: string, title: string): string {
  return `https://${domain}/wiki/${encodeURIComponent(title.replaceAll(' ', '_')).replaceAll('%3A', ':')}`
}

/**
 * Wikidata titles are entity ids (Q42, Property:P31, Lexeme:L7), not article names, and
 * the stream carries no label for them, so they are shown as ids with their entity kind.
 */
export function describePage(domain: string, title: string): PageLabel {
  const url = pageUrl(domain, title)
  if (domain === WIKIDATA_DOMAIN) {
    const entity = WIKIDATA_ENTITY.exec(title)
    if (entity) return { name: `${entity[1]}${entity[2]}`, kind: WIKIDATA_KINDS[entity[1]], url }
  }
  const separator = title.indexOf(':')
  if (separator > 0) {
    const prefix = title.slice(0, separator)
    if (NAMESPACES.has(prefix)) return { name: title.slice(separator + 1), kind: prefix, url }
  }
  return { name: title, kind: null, url }
}
