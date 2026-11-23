// A "symbol" is an identifier as a reader sees it: d_k, W_i^Q, ŷ, λ.
// arXiv HTML (LaTeXML), KaTeX and Wikipedia all expose Presentation MathML,
// so symbols are read from the MathML tree rather than from rendered glyphs.

// Superscripts that modify a symbol instead of naming a new one: K^T is still K.
const MODIFIER_SUPS = new Set(['T', '⊤', '′', '″', '*', '∗', '†']);
const NUMERIC = /^[−-]?[\d.]+$/;
const SKIP = new Set(['annotation', 'annotation-xml']);
// Number sets and constants are notation, not author-defined symbols.
const NOT_SYMBOLS = new Set(['ℝ', 'ℕ', 'ℤ', 'ℚ', 'ℂ', '∞']);
// LaTeXML separates the letters of italic words (pos, warmup) with invisible <mo> separators (U+200B, U+2062).
const INVISIBLE = /[\s\u200b-\u200d\u2060-\u2064\ufeff]/g;
const MIN_WORD_LETTERS = 3;

const text = (el: Element): string => (el.textContent ?? '').replace(INVISIBLE, '');

const isLetterIdentifier = (el: Element): boolean => {
  const t = text(el);
  return el.localName === 'mi' && [...t].length === 1 && /\p{L}/u.test(t) && !NOT_SYMBOLS.has(t);
};

/** Unwrap <mrow> wrappers that hold a single child (LaTeXML emits these around bases). */
function unwrap(el: Element | undefined): Element | undefined {
  while (el?.localName === 'mrow' && el.children.length === 1) el = el.children[0];
  return el;
}

/** A superscript is a modifier (transpose, prime, inverse) or a power (x^2) — not part of the name. */
const isModifier = (sup: Element): boolean => NUMERIC.test(text(sup)) || MODIFIER_SUPS.has(text(sup));

/**
 * Stable key for a MathML element, or null if it is not a symbol.
 * Single-character <mi> only: multi-letter <mi> are function names (softmax, exp).
 */
export function symbolKey(node: Element | undefined): string | null {
  const el = unwrap(node);
  if (!el) return null;
  const [a, b, c] = Array.from(el.children);
  switch (el.localName) {
    case 'mi':
      return isLetterIdentifier(el) ? text(el) : null;
    case 'msub': {
      const base = symbolKey(a);
      return base && b ? `${base}_${text(b)}` : null;
    }
    case 'msup': {
      const base = symbolKey(a);
      if (!base || !b) return null;
      return isModifier(b) ? base : `${base}^${text(b)}`;
    }
    case 'msubsup': {
      const base = symbolKey(a);
      if (!base || !b || !c) return null;
      return isModifier(c) ? `${base}_${text(b)}` : `${base}_${text(b)}^${text(c)}`;
    }
    case 'mover': {
      // Accented symbols (ŷ, x̄, θ̃) are distinct from their base.
      const base = symbolKey(a);
      return base && b ? `${text(b)}(${base})` : null;
    }
    default:
      return null;
  }
}

export interface SymbolNode {
  el: Element;
  key: string;
}

/**
 * Length of an italic word starting at children[i]: letters joined by invisible
 * times (p⁢o⁢s). Returns 0 when the run is shorter than MIN_WORD_LETTERS, so
 * genuine products like Q⁢K stay separate symbols.
 */
function wordRun(children: Element[], i: number): { word: string; length: number } {
  let word = '';
  let j = i;
  while (children[j] && isLetterIdentifier(children[j]!)) {
    word += text(children[j]!);
    const next = children[j + 1];
    if (next?.localName === 'mo' && text(next) === '') j += 2;
    else {
      j += 1;
      break;
    }
  }
  return [...word].length >= MIN_WORD_LETTERS ? { word, length: j - i } : { word: '', length: 0 };
}

/** Outermost symbols in a formula, in document order (d_k counts once, not as d and k). */
export function symbolsIn(math: Element): SymbolNode[] {
  const out: SymbolNode[] = [];
  const walk = (el: Element): void => {
    const children = Array.from(el.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      if (SKIP.has(child.localName)) continue;
      const run = wordRun(children, i);
      if (run.length) {
        out.push({ el: child, key: run.word });
        i += run.length - 1;
        continue;
      }
      const key = symbolKey(child);
      if (key) out.push({ el: child, key });
      else walk(child);
    }
  };
  walk(math);
  return out;
}
