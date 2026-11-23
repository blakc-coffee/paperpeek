// Which origins the reader enabled, derived from granted optional host
// permissions (the permission itself is the source of truth; nothing else is stored).

/** Built into the manifest, so never shown as "enabled by you". */
const BUILT_IN = /^https:\/\/(arxiv\.org|ar5iv\.labs\.arxiv\.org)\//;

/** "https://en.wikipedia.org/wiki/X" → "https://en.wikipedia.org/*"; null for non-web pages. */
export function originPattern(url: string | undefined): string | null {
  if (!url || !URL.canParse(url)) return null;
  const u = new URL(url);
  return u.protocol === 'https:' || u.protocol === 'http:' ? `${u.protocol}//${u.hostname}/*` : null;
}

/** The match patterns the site content script should run on. */
export function enabledPatterns(granted: readonly string[] | undefined): string[] {
  return [...new Set((granted ?? []).filter((o) => !BUILT_IN.test(o) && /^https?:\/\/[^*/]+\/\*$/.test(o)))].sort();
}
