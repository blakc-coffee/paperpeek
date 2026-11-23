// Deterministic definition detection for symbols in prose.
// Sentences arrive with each inline formula replaced by a §i§ placeholder,
// so patterns stay plain regexes over text. Every result carries a confidence
// and the popup always shows the source sentence, so a weak match still helps.

export interface SentenceMath {
  id: string;
  keys: string[];
}

export interface Sentence {
  /** Prose with formulas replaced by placeholder(i), indexing into `maths`. */
  text: string;
  maths: SentenceMath[];
}

export interface Definition {
  mathId: string;
  key: string;
  gloss: string;
  confidence: number;
}

export const placeholder = (i: number): string => `§${i}§`;

const M = '§(\\d+)§';
const GLOSS = '([^,;:.§]+)';
const STRONG = 0.9;
const MEDIUM = 0.7;
const WEAK = 0.5;

// Gloss follows the symbol: "where d_k is the dimension of the keys".
// The third field marks "X is/are …" patterns, where a past participle
// ("X is scaled", "X are computed") describes an action, not a definition.
const AFTER: Array<[RegExp, number, boolean]> = [
  [new RegExp(`\\blet\\s+${M}\\s+(?:be|denote)\\s+${GLOSS}`, 'gi'), STRONG, false],
  [
    new RegExp(
      `${M}\\s+(?:denotes|denote|represents|represent|stands for|refers to|is defined as|is called|are called)\\s+${GLOSS}`,
      'gi',
    ),
    STRONG,
    false,
  ],
  [new RegExp(`\\b(?:where|and|with|here)\\s+${M}\\s+(?:is|are)\\s+${GLOSS}`, 'gi'), STRONG, true],
  [new RegExp(`(?:^|[.!?]\\s+)${M}\\s+(?:is|are)\\s+((?:the|a|an)\\s+[^,;:.§]+)`, 'gi'), MEDIUM, true],
];
const PARTICIPLE = /^\w+ed$/i;

// Gloss precedes the symbol: "we denote the number of layers by N".
const BEFORE = new RegExp(`\\bdenoted?\\s+(?:the\\s+)?([^,;:.§]+?)\\s+(?:by|as)\\s+${M}`, 'gi');

const LEADING_FILLER = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'with', 'for', 'to', 'by', 'in', 'on']);
const TRAILING_CUT = /\s+(?:which|that|where|while|whose|and\s+is|and\s+are)\b.*$/i;
// Words that end a noun phrase when scanning backwards from a symbol.
const STOP = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
  'we', 'our', 'it', 'its', 'this', 'that', 'these', 'those', 'which', 'then', 'thus', 'so',
  'here', 'there', 'now', 'also', 'hence', 'therefore', 'finally', 'first', 'second', 'next',
  'let', 'denote', 'denotes', 'where', 'when', 'if', 'by', 'as', 'than',
  'compute', 'computes', 'computed', 'use', 'uses', 'used', 'using', 'apply', 'applies', 'applied',
  'obtain', 'obtains', 'set', 'sets', 'get', 'gets', 'give', 'gives', 'yield', 'yields',
  'consist', 'consists', 'contain', 'contains', 'take', 'takes', 'multiply', 'divide', 'add',
]);
// A noun phrase ending in one of these is not naming the symbol: "the sum of x".
const DANGLING = new Set(['of', 'to', 'in', 'on', 'for', 'from', 'with', 'over', 'at', 'and', 'or', 'the', 'a', 'an']);
const MAX_GLOSS_WORDS = 10;

function clean(raw: string): string {
  const words = raw.replace(TRAILING_CUT, '').trim().split(/\s+/).filter(Boolean);
  while (words.length && LEADING_FILLER.has((words[0] ?? '').toLowerCase())) words.shift();
  return words.slice(0, MAX_GLOSS_WORDS).join(' ');
}

/** Appositive: up to 5 words right before the symbol, e.g. "queries and keys of dimension d_k". */
function nounPhraseBefore(text: string, end: number): string {
  const words = text.slice(0, end).trimEnd().split(/\s+/);
  const phrase: string[] = [];
  for (let i = words.length - 1; i >= 0 && phrase.length < 6; i--) {
    const w = words[i];
    if (!w || /[,;:.!?()§]$/.test(w) || w.includes('§') || STOP.has(w.toLowerCase())) break;
    phrase.unshift(w);
  }
  const last = phrase.at(-1);
  if (!last || DANGLING.has(last.toLowerCase())) return '';
  return clean(phrase.join(' '));
}

export function findDefinitions(sentence: Sentence): Definition[] {
  const best = new Map<number, Definition>();
  const offer = (index: number, gloss: string, confidence: number): void => {
    const math = sentence.maths[index];
    const key = math?.keys[0];
    if (!math || !key || !gloss) return;
    const current = best.get(index);
    if (!current || current.confidence < confidence) {
      best.set(index, { mathId: math.id, key, gloss, confidence });
    }
  };

  for (const [pattern, confidence, copula] of AFTER) {
    for (const m of sentence.text.matchAll(pattern)) {
      const raw = m[2] ?? '';
      if (copula && PARTICIPLE.test(raw.trim().split(/\s+/)[0] ?? '')) continue;
      offer(Number(m[1]), clean(raw), confidence);
    }
  }
  for (const m of sentence.text.matchAll(BEFORE)) offer(Number(m[2]), clean(m[1] ?? ''), STRONG);

  for (const m of sentence.text.matchAll(/§(\d+)§/g)) {
    const index = Number(m[1]);
    if (!best.has(index)) offer(index, nounPhraseBefore(sentence.text, m.index), WEAK);
  }

  return [...best.values()];
}
