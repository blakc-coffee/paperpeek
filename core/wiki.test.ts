import { describe, expect, it, vi } from 'vitest';
import { CACHE_MAX, CACHE_TTL_MS, cached, lookupWikipedia, parseSummary, type CacheArea, type Fetch } from './wiki';

const page = (title: string, extra: Record<string, unknown> = {}) => ({
  type: 'standard',
  title,
  extract: `${title} is a thing.`,
  content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}` } },
  ...extra,
});

function fakeFetch(routes: Record<string, { status?: number; body?: unknown }>): Fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    const r = key ? routes[key]! : { status: 404 };
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.body };
  }) as Fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}

describe('parseSummary', () => {
  it('keeps text, article URL and a wikimedia thumbnail', () => {
    const s = parseSummary(page('Beam search', { thumbnail: { source: 'https://upload.wikimedia.org/a.gif', width: 330, height: 218 } }), 'beam search');
    expect(s).toEqual({
      title: 'Beam search',
      extract: 'Beam search is a thing.',
      url: 'https://en.wikipedia.org/wiki/Beam_search',
      closest: false,
      thumbnail: { src: 'https://upload.wikimedia.org/a.gif', width: 330, height: 218 },
    });
  });

  it('drops thumbnails from other hosts, disambiguation pages and foreign article URLs', () => {
    expect(parseSummary(page('X', { thumbnail: { source: 'https://evil.example/a.png', width: 1, height: 1 } }), 'x')?.thumbnail).toBeUndefined();
    expect(parseSummary(page('Mercury', { type: 'disambiguation' }), 'mercury')).toBeNull();
    expect(parseSummary(page('X', { content_urls: { desktop: { page: 'javascript:alert(1)' } } }), 'x')).toBeNull();
    expect(parseSummary('nope', 'x')).toBeNull();
  });

  it('flags a different title as the closest article and truncates long extracts', () => {
    const s = parseSummary(page('Label noise', { extract: 'a'.repeat(900) }), 'label smoothing')!;
    expect(s.closest).toBe(true);
    expect(s.extract).toHaveLength(600);
    expect(s.extract.endsWith('…')).toBe(true);
  });
});

describe('lookupWikipedia', () => {
  it('uses the exact title when it exists and sends only the term', async () => {
    const fetchFn = fakeFetch({ '/page/summary/Beam_search': { body: page('Beam search') } });
    expect((await lookupWikipedia('beam search', fetchFn))?.title).toBe('Beam search');
    expect(fetchFn.calls).toEqual(['https://en.wikipedia.org/api/rest_v1/page/summary/Beam_search?redirect=true']);
  });

  it('falls back to the top search hit, then gives null when there is none', async () => {
    const fetchFn = fakeFetch({
      'search/page?q=label%20smoothing': { body: { pages: [{ title: 'Label noise' }] } },
      '/page/summary/Label_noise': { body: page('Label noise') },
    });
    expect(await lookupWikipedia('label smoothing', fetchFn)).toMatchObject({ title: 'Label noise', closest: true });
    expect(await lookupWikipedia('zzqx', fakeFetch({ 'search/page': { body: { pages: [] } } }))).toBeNull();
  });

  it('throws on server errors so the UI can offer a retry', async () => {
    await expect(lookupWikipedia('x', fakeFetch({ '/page/summary/': { status: 503 } }))).rejects.toThrow('503');
  });
});

function memoryArea(): CacheArea & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async (k) => (k === null ? { ...data } : k in data ? { [k]: data[k] } : {}),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => keys.forEach((k) => delete data[k]),
  };
}

describe('cached', () => {
  it('serves repeat lookups from storage until the TTL passes', async () => {
    const area = memoryArea();
    const lookup = vi.fn(async (t: string) => parseSummary(page(t), t));
    let now = 0;
    const get = cached(area, lookup, () => now);
    await get('Dropout');
    await get('dropout');
    expect(lookup).toHaveBeenCalledTimes(1);
    now = CACHE_TTL_MS + 1;
    await get('dropout');
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest entries beyond the cap', async () => {
    const area = memoryArea();
    area.data.other = 1;
    let now = 0;
    const get = cached(area, async () => null, () => ++now);
    for (let i = 0; i <= CACHE_MAX; i++) await get(`t${i}`);
    expect(Object.keys(area.data).filter((k) => k.startsWith('wiki:'))).toHaveLength(CACHE_MAX);
    expect('wiki:t0' in area.data).toBe(false);
    expect(area.data.other).toBe(1);
  });
});
