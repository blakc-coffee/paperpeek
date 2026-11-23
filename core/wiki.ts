// Wikipedia fallback for terms outside the bundled glossary. Only the term is
// sent; results are plain data (text, one https thumbnail URL, the article URL).

export interface WikiSummary {
  title: string;
  extract: string;
  url: string;
  /** True when the article is a search match whose title differs from the term. */
  closest: boolean;
  thumbnail?: { src: string; width: number; height: number };
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

const API = 'https://en.wikipedia.org';
// Wikimedia asks API clients to identify themselves; browsers forbid setting User-Agent.
const HEADERS = { 'Api-User-Agent': 'PaperPeek-extension (https://github.com/blakc-coffee/paperpeek)' };
const MAX_EXTRACT = 600;

const sameName = (a: string, b: string): boolean =>
  a.toLowerCase().replace(/[-_\s]+/g, ' ').replace(/s$/, '') === b.toLowerCase().replace(/[-_\s]+/g, ' ').replace(/s$/, '');

/** Reads a REST `page/summary` response; null for disambiguation pages or missing fields. */
export function parseSummary(json: unknown, term: string): WikiSummary | null {
  if (!json || typeof json !== 'object') return null;
  const d = json as Record<string, unknown>;
  const title = typeof d.title === 'string' ? d.title : '';
  const extract = typeof d.extract === 'string' ? d.extract.trim() : '';
  const page = (d.content_urls as { desktop?: { page?: unknown } } | undefined)?.desktop?.page;
  if (d.type === 'disambiguation' || !title || !extract || typeof page !== 'string' || !page.startsWith(`${API}/wiki/`)) {
    return null;
  }
  const summary: WikiSummary = {
    title,
    extract: extract.length > MAX_EXTRACT ? `${extract.slice(0, MAX_EXTRACT - 1).trimEnd()}…` : extract,
    url: page,
    closest: !sameName(title, term),
  };
  const thumb = d.thumbnail as { source?: unknown; width?: unknown; height?: unknown } | undefined;
  if (thumb && typeof thumb.source === 'string' && typeof thumb.width === 'number' && typeof thumb.height === 'number') {
    const src = URL.canParse(thumb.source) ? new URL(thumb.source) : null;
    if (src?.protocol === 'https:' && src.hostname.endsWith('.wikimedia.org')) {
      summary.thumbnail = { src: src.href, width: thumb.width, height: thumb.height };
    }
  }
  return summary;
}

async function summaryOf(title: string, term: string, fetchFn: Fetch): Promise<WikiSummary | null | 'missing'> {
  const res = await fetchFn(`${API}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`, {
    headers: HEADERS,
  });
  if (res.status === 404) return 'missing';
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
  return parseSummary(await res.json(), term);
}

/**
 * The article for `term`: its exact title first, then the top full-text search
 * hit (flagged `closest`). null when Wikipedia has nothing usable. Throws on
 * network or server errors so the caller can offer a retry.
 */
export async function lookupWikipedia(term: string, fetchFn: Fetch): Promise<WikiSummary | null> {
  const exact = await summaryOf(term.charAt(0).toUpperCase() + term.slice(1), term, fetchFn);
  if (exact !== 'missing') return exact;
  const res = await fetchFn(`${API}/w/rest.php/v1/search/page?q=${encodeURIComponent(term)}&limit=1`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Wikipedia search returned ${res.status}`);
  const top = ((await res.json()) as { pages?: { title?: unknown }[] }).pages?.[0]?.title;
  if (typeof top !== 'string') return null;
  const hit = await summaryOf(top, term, fetchFn);
  return hit === 'missing' ? null : hit;
}

export interface CacheArea {
  get(keys: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

const PREFIX = 'wiki:';
export const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
export const CACHE_MAX = 200;

/** Wraps a lookup with a TTL cache in extension storage, evicting the oldest past CACHE_MAX. */
export function cached(
  area: CacheArea,
  lookup: (term: string) => Promise<WikiSummary | null>,
  now: () => number = Date.now,
): (term: string) => Promise<WikiSummary | null> {
  return async (term) => {
    const key = PREFIX + term.toLowerCase();
    const hit = (await area.get(key))[key] as { t: number; v: WikiSummary | null } | undefined;
    if (hit && now() - hit.t < CACHE_TTL_MS) return hit.v;
    const value = await lookup(term);
    await area.set({ [key]: { t: now(), v: value } });
    const all = await area.get(null);
    const entries = Object.entries(all).filter(([k]) => k.startsWith(PREFIX)) as [string, { t: number }][];
    if (entries.length > CACHE_MAX) {
      entries.sort((a, b) => a[1].t - b[1].t);
      await area.remove(entries.slice(0, entries.length - CACHE_MAX).map(([k]) => k));
    }
    return value;
  };
}
