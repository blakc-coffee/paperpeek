// A "symbol" is an identifier as a reader sees it: d_k, W_i^Q, ŷ, λ.
// arXiv HTML (LaTeXML), KaTeX and Wikipedia all expose Presentation MathML,
// so symbols are read from the MathML tree rather than from rendered glyphs.

// Superscripts that modify a symbol instead of naming a new one: K^T is still K.
const MODIFIER_SUPS = new Set(['T', '⊤', '′', '″', '*', '∗', '†', '−1', '-1']);
const SKIP = new Set(['annotation', 'annotation-xml']);

const text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, '');

/** Unwrap <mrow> wrappers that hold a single child (LaTeXML emits these around bases). */
function unwrap(el: Element | undefined): Element | undefined {
  while (el?.localName === 'mrow' && el.children.length === 1) el = el.children[0];
  return el;
}

/** A superscript is a modifier (transpose, prime, inverse) or a power (x^2) — not part of the name. */
const isModifier = (sup: Element): boolean =>
  unwrap(sup)?.localName === 'mn' || MODIFIER_SUPS.has(text(sup));

/**
 * Stable key for a MathML element, or null if it is not a symbol.
 * Single-character <mi> only: multi-letter <mi> are function names (softmax, exp).
 */
export function symbolKey(node: Element | undefined): string | null {
  const el = unwrap(node);
  if (!el) return null;
  const [a, b, c] = Array.from(el.children);
  switch (el.localName) {
    case 'mi': {
      const t = text(el);
      return [...t].length === 1 ? t : null;
    }
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

/** Outermost symbols in a formula, in document order (d_k counts once, not as d and k). */
export function symbolsIn(math: Element): SymbolNode[] {
  const out: SymbolNode[] = [];
  const walk = (el: Element): void => {
    for (const child of Array.from(el.children)) {
      if (SKIP.has(child.localName)) continue;
      const key = symbolKey(child);
      if (key) out.push({ el: child, key });
      else walk(child);
    }
  };
  walk(math);
  return out;
}
