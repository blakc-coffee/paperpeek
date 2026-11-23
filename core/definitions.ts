// Deterministic definition detection for symbols in prose.
// Sentences arrive with each inline formula replaced by a §i§ placeholder,
// so patterns stay plain regexes over text. Every result carries a confidence
// and the popup always shows the source sentence, so a weak match still helps.

export interface SentenceMath {
  id: string;
  keys: string[];
  /** Formula is "X = <number>", as in "a stack of N = 6 identical layers". */
  assigns?: boolean;
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
const GUESS = 0.4;

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
  // Lookbehind so "where a is …, and b is …" matches both: the prefix is not consumed.
  [new RegExp(`(?<=\\b(?:where|and|with|here)\\s+)${M}\\s+(?:is|are)\\s+${GLOSS}`, 'gi'), STRONG, true],
  // Later items of a "where" list: "where W is a matrix, V is the vocabulary size".
  [new RegExp(`(?<=,\\s*)${M}\\s+(?:is|are)\\s+((?:the|a|an)\\s+[^,;:.§]+)`, 'gi'), MEDIUM, true],
  [new RegExp(`(?:^|[.!?]\\s+)${M}\\s+(?:is|are)\\s+((?:the|a|an)\\s+[^,;:.§]+)`, 'gi'), MEDIUM, true],
];
const PARTICIPLE = /^\w+ed$/i;

// Paired lists: "a and b are the input and output, respectively" gives each symbol its own gloss.
const RESPECTIVELY = new RegExp(
  `((?:§\\d+§\\s*,\\s*)*§\\d+§\\s*,?\\s*and\\s+§\\d+§)\\s+(?:are|denote|represent|stand for|correspond to)\\s+([^;:.§]+?),?\\s+respectively\\b`,
  'gi',
);

// Coordinated symbols share one gloss: "where a, b, and c are trainable parameters".
const LIST = new RegExp(
  `(?:\\b(where|and|with|here)\\s+)?((?:§\\d+§\\s*,\\s*)+(?:and\\s+)?§\\d+§|§\\d+§\\s+and\\s+§\\d+§)\\s+are\\s+${GLOSS}`,
  'gi',
);

// "a mini-batch of N examples", "move it by k frames": the symbol counts the noun after it.
const COUNT = new RegExp(`(?<=\\b(?:of|by|with|over|for|uses?|has|have|contains?)\\s+)${M}\\s+([a-z]+s)\\b(?!\\s+(?:of|is|are)\\b)`, 'g');

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
  'generate', 'generates', 'produce', 'produces', 'require', 'requires', 'employ', 'employs',
  'implement', 'implements', 'perform', 'performs', 'project', 'projects', 'considering',
  'whereas', 'together', 'into', 'onto', 'via', 'but', 'because', 'since', 'while',
]);
const DETERMINER = new Set(['the', 'a', 'an']);
// A noun phrase ending in one of these is not naming the symbol: "the sum of x".
const DANGLING = new Set(['of', 'to', 'in', 'on', 'for', 'from', 'with', 'over', 'at', 'and', 'or', 'the', 'a', 'an']);
const MAX_GLOSS_WORDS = 10;

function clean(raw: string): string {
  const words = raw.replace(TRAILING_CUT, '').trim().split(/\s+/).filter(Boolean);
  while (words.length && LEADING_FILLER.has((words[0] ?? '').toLowerCase())) words.shift();
  while (words.length && DANGLING.has((words.at(-1) ?? '').toLowerCase())) words.pop();
  // A lone adverb or gerund ("simply", "Writing") is never a definition.
  if (words.length === 1 && /(?:ly|ing)$/i.test(words[0] ?? '')) return '';
  return words.slice(0, MAX_GLOSS_WORDS).join(' ');
}

/**
 * Appositive: the noun phrase right before the symbol, e.g. "queries and keys
 * of dimension d_k". Scanning backwards stops at punctuation, verbs and
 * participles; the phrase then starts after its last determiner, so
 * "a function of the previous hidden state h" yields "previous hidden state".
 */
function nounPhraseBefore(text: string, end: number): string {
  const words = text.slice(0, end).trimEnd().split(/\s+/);
  const phrase: string[] = [];
  for (let i = words.length - 1; i >= 0 && phrase.length < 6; i--) {
    const w = words[i];
    const lower = w?.toLowerCase() ?? '';
    if (!w || /[,;:.!?()§\]]$/.test(w) || /^[(\[]/.test(w) || w.includes('§') || STOP.has(lower) || PARTICIPLE.test(w)) break;
    phrase.unshift(w);
  }
  const last = phrase.at(-1);
  if (!last || DANGLING.has(last.toLowerCase())) return '';
  const det = phrase.findLastIndex((w) => DETERMINER.has(w.toLowerCase()));
  return clean(phrase.slice(det + 1).join(' '));
}

/** "a stack of N = 6 identical layers" → "identical layers". */
function nounPhraseAfter(text: string, start: number): string {
  const m = /^\s+([a-z][\w-]*(?:\s+[a-z][\w-]*){0,4})/.exec(text.slice(start));
  if (!m?.[1]) return '';
  const words: string[] = [];
  for (const w of m[1].split(/\s+/)) {
    if (STOP.has(w) || DANGLING.has(w) || /^(?:each|which|that|times)$/.test(w)) break;
    words.push(w);
  }
  return clean(words.join(' '));
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

  // First, so each symbol keeps its own gloss: later patterns only replace lower-confidence results.
  const pair = (symbolList: string, glossList: string): void => {
    const symbols = [...symbolList.matchAll(/§(\d+)§/g)].map((s) => Number(s[1]));
    const glosses = glossList.split(/\s*,\s*(?:and\s+)?|\s+and\s+/).map(clean).filter(Boolean);
    // Only when the two lists line up one to one; "queries and keys" inside a gloss would break the pairing.
    if (glosses.length !== symbols.length) return;
    symbols.forEach((index, i) => offer(index, glosses[i]!, STRONG));
  };
  for (const m of sentence.text.matchAll(RESPECTIVELY)) pair(m[1] ?? '', m[2] ?? '');
  for (const [pattern, confidence, copula] of AFTER) {
    for (const m of sentence.text.matchAll(pattern)) {
      const raw = m[2] ?? '';
      if (copula && PARTICIPLE.test(raw.trim().split(/\s+/)[0] ?? '')) continue;
      offer(Number(m[1]), clean(raw), confidence);
    }
  }
  for (const m of sentence.text.matchAll(BEFORE)) offer(Number(m[2]), clean(m[1] ?? ''), STRONG);
  for (const m of sentence.text.matchAll(LIST)) {
    const raw = m[3] ?? '';
    if (PARTICIPLE.test(raw.trim().split(/\s+/)[0] ?? '')) continue;
    const gloss = clean(raw);
    for (const s of (m[2] ?? '').matchAll(/§(\d+)§/g)) offer(Number(s[1]), gloss, m[1] ? STRONG : MEDIUM);
  }
  for (const m of sentence.text.matchAll(COUNT)) {
    const noun = m[2] ?? '';
    if (!STOP.has(noun) && !DANGLING.has(noun)) offer(Number(m[1]), `number of ${noun}`, GUESS);
  }

  for (const m of sentence.text.matchAll(/§(\d+)§/g)) {
    const index = Number(m[1]);
    if (sentence.maths[index]?.assigns) offer(index, nounPhraseAfter(sentence.text, m.index + m[0].length), MEDIUM);
    if (!best.has(index)) offer(index, nounPhraseBefore(sentence.text, m.index), WEAK);
  }

  return [...best.values()];
}
