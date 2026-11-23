// Pure parsers for the build-time glossary pipeline (scripts/build-glossary.ts).
// Both sources become GlossaryEntry objects with per-entry source and license.

import type { GlossaryEntry } from '../core/glossary';

const MAX_SHORT = 220;
const ADICTML = { source: 'Aalto Dictionary of ML (adapted)', license: 'CC BY 4.0', url: 'https://aaltodictionaryofml.github.io/' };
const WIKIDATA = { source: 'Wikidata', license: 'CC0' };

/** The `{…}` group starting at `open` (which must be "{"), with nested braces balanced. */
function group(text: string, open: number): { body: string; end: number } | null {
  if (text[open] !== '{') return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return { body: text.slice(open + 1, i), end: i + 1 };
  }
  return null;
}

/** `name={…}, description={…}` → { name, description }, reading only top-level fields. */
function fields(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(?:^|,)\s*([a-z]+)\s*=\s*/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const g = group(body, re.lastIndex);
    if (!g || !m[1]) continue;
    out[m[1]] = g.body;
    re.lastIndex = g.end;
  }
  return out;
}

interface RawEntry {
  key: string;
  f: Record<string, string>;
}

export function adictmlEntries(texFiles: readonly string[]): RawEntry[] {
  const out: RawEntry[] = [];
  for (const tex of texFiles) {
    const re = /\\newglossaryentry\{([^}]+)\}\s*/g;
    for (let m = re.exec(tex); m; m = re.exec(tex)) {
      const g = group(tex, re.lastIndex);
      if (!g || !m[1]) continue;
      out.push({ key: m[1], f: fields(g.body) });
      re.lastIndex = g.end;
    }
  }
  return out;
}

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** LaTeX prose → plain text. Leaves "$" or "\" behind when it meets maths or unknown macros. */
export function latexToText(tex: string, glossText: (key: string, plural: boolean, capital: boolean) => string): string {
  let s = tex
    .replace(/(?<!\\)%.*$/gm, '')
    .replace(/\\(?:index|label|cite[pt]?)(?:\[[^\]]*\])?\{[^}]*\}/g, '')
    .replace(/\\(gls|glspl|Gls|Glspl)\{([^}]+)\}/g, (_, cmd: string, key: string) => glossText(key, cmd.endsWith('pl'), cmd[0] === 'G'))
    .replace(/\\(?:emph|textit|textbf|textrm|text|mbox)\{([^{}]*)\}/g, '$1')
    .replace(/``|''/g, '"')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\\\\|~|\\,|\\ /g, ' ')
    .replace(/\\([%&_#])/g, '$1');
  s = s.replace(/\{([^{}$\\]*)\}/g, '$1');
  // Removed citations leave " , , ." behind.
  return squash(s)
    .replace(/(?:\s*,)+\s*([.;:!?])/g, '$1')
    .replace(/\s+([,.;:!?])/g, '$1')
    // Expanding "an \gls{mab}" to words needs the article fixed ("a" before a consonant-initial lowercase word).
    .replace(/\b([Aa])n ([b-df-hj-np-tv-z])/g, '$1 $2')
    .replace(/\b([Aa]) ([aeio])/g, '$1n $2');
}

/** The first sentence of `text`, or null when it carries maths/macros or is too long for a popup. */
export function firstSentence(text: string): string | null {
  const first = text.split(/(?<=[.!?])\s+(?=[A-Z])/)[0]?.trim() ?? '';
  if (!first || /[$\\{}]/.test(first) || first.length > MAX_SHORT || first.split(' ').length < 5) return null;
  return /[.!?]$/.test(first) ? first : `${first}.`;
}

/** "machine learning (ML)" → term "machine learning", alias "ML". */
function splitAcronym(name: string): { term: string; aliases: string[] } {
  const m = /^(.*?)\s*\(([^()]+)\)$/.exec(name);
  if (!m?.[1] || !m[2]) return { term: name, aliases: [] };
  return { term: m[1], aliases: m[2].length >= 3 ? [m[2]] : [] };
}

export function fromAdictml(texFiles: readonly string[]): GlossaryEntry[] {
  const raw = adictmlEntries(texFiles);
  const byKey = new Map(raw.map((e) => [e.key, e.f]));
  // \gls{rv} reads better as "random variable" than as the acronym in its text= field.
  const glossText = (key: string, plural: boolean, capital: boolean): string => {
    const f = byKey.get(key);
    const name = splitAcronym((f?.name ?? key).replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')).term;
    const base = plural ? (f?.plural && !/^[A-Z]+s?$/.test(f.plural) && !f.plural.includes('\\') ? f.plural : `${name}s`) : name;
    const plain = base.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
    return capital ? plain.charAt(0).toUpperCase() + plain.slice(1) : plain;
  };
  const out: GlossaryEntry[] = [];
  for (const { key, f } of raw) {
    if (!f.name || !f.description) continue;
    const name = latexToText(f.name, glossText);
    if (!name || /[$\\]/.test(name)) continue;
    const short = firstSentence(latexToText(f.description, glossText));
    if (!short) continue;
    const { term, aliases } = splitAcronym(name);
    out.push({ id: `adictml:${key}`, term, ...(aliases.length ? { aliases } : {}), short, ...ADICTML });
  }
  return out;
}

export interface WikidataRow {
  item: { value: string };
  label: { value: string };
  desc: { value: string };
  article: { value: string };
  alts?: { value: string };
}

/** Too generic to match on their own as aliases. */
const GENERIC = new Set(['model', 'network', 'learning', 'method', 'algorithm', 'analysis', 'function', 'system', 'data', 'training']);

export function fromWikidata(rows: readonly WikidataRow[]): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  for (const row of rows) {
    const term = squash(row.label.value);
    const desc = squash(row.desc.value).replace(/\s+([,.;:!?])/g, '$1');
    if (term.length < 3 || desc.split(' ').length < 3 || !row.article.value.startsWith('https://en.wikipedia.org/wiki/')) continue;
    // Single capitalised words are almost always products or named models (Midjourney, Perceiver), not concepts.
    if (/^[A-Z][a-z][\w-]*$/.test(term)) continue;
    const aliases = (row.alts?.value ?? '')
      .split('|')
      .map(squash)
      .filter((a) => a.length >= 3 && !GENERIC.has(a.toLowerCase()) && a.toLowerCase() !== term.toLowerCase());
    out.push({
      id: `wikidata:${row.item.value.split('/').pop() ?? term}`,
      term,
      ...(aliases.length ? { aliases: [...new Set(aliases)].slice(0, 5) } : {}),
      short: `${desc.charAt(0).toUpperCase()}${desc.slice(1)}${/[.!?]$/.test(desc) ? '' : '.'}`.slice(0, MAX_SHORT),
      ...WIKIDATA,
      url: row.article.value,
    });
  }
  return out;
}

const norm = (s: string): string => s.toLowerCase().replace(/[-–\s]+/g, ' ').trim();

/**
 * Concatenates sources in priority order, dropping any entry whose term is
 * already taken and any alias that is, so every name maps to one entry.
 */
export function mergeGlossaries(...sources: readonly GlossaryEntry[][]): GlossaryEntry[] {
  const taken = new Set<string>();
  const out: GlossaryEntry[] = [];
  for (const entries of sources) {
    for (const entry of entries) {
      if (taken.has(norm(entry.term))) continue;
      taken.add(norm(entry.term));
      // Also drops aliases that differ from an earlier name only by case or hyphenation.
      const aliases = (entry.aliases ?? []).filter((a) => !taken.has(norm(a)) && Boolean(taken.add(norm(a))));
      const { aliases: _drop, ...rest } = entry;
      out.push(aliases.length ? { ...rest, aliases } : rest);
    }
  }
  return out;
}
