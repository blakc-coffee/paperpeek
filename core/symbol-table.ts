// Which definition applies where. Papers reuse and redefine symbols, so a
// lookup is position-aware: the nearest definition *before* the hovered
// occurrence wins (ScholarPhi, Head et al. CHI 2021).

export interface DefinitionInfo {
  gloss: string;
  confidence: number;
  /** Source sentence with formulas as $TeX$, for logs and tests. */
  sentence: string;
  /** Same sentence as text runs and the page's own <math> elements, for the popup to clone. */
  parts: Array<string | Element>;
}

export interface Occurrence {
  key: string;
  /** Document order across all symbol occurrences. */
  order: number;
  mathId: string;
  sectionId: string | null;
  el: Element;
  /** The rendered KaTeX/MathJax formula this symbol sits in, when `el` lives in its hidden MathML copy. */
  formula?: Element;
  definition?: DefinitionInfo;
}

export type LookupKind = 'preceding' | 'later' | 'first-use';

export interface LookupResult {
  occurrence: Occurrence;
  kind: LookupKind;
}

/** Definitions at or above this confidence beat a closer, weaker one. */
const TRUSTED = 0.7;
/** Weak but usually right (e.g. the noun phrase just before the symbol); lower scores are guesses. */
const PLAUSIBLE = 0.5;

export class SymbolTable {
  private readonly byKey = new Map<string, Occurrence[]>();
  readonly byElement = new Map<Element, Occurrence>();
  /** Symbols per rendered KaTeX/MathJax formula, whose glyphs can't be mapped one by one. */
  readonly byFormula = new Map<Element, Occurrence[]>();

  constructor(occurrences: Occurrence[]) {
    for (const occ of [...occurrences].sort((a, b) => a.order - b.order)) {
      const list = this.byKey.get(occ.key);
      if (list) list.push(occ);
      else this.byKey.set(occ.key, [occ]);
      this.byElement.set(occ.el, occ);
      if (occ.formula) {
        const inFormula = this.byFormula.get(occ.formula);
        if (inFormula) inFormula.push(occ);
        else this.byFormula.set(occ.formula, [occ]);
      }
    }
  }

  get keys(): string[] {
    return [...this.byKey.keys()];
  }

  occurrences(key: string): readonly Occurrence[] {
    return this.byKey.get(key) ?? [];
  }

  /** Definition that applies to `key` at document position `order`. */
  lookup(key: string, order: number): LookupResult | undefined {
    const all = this.byKey.get(key);
    if (!all?.length) return undefined;
    const defs = all.filter((o) => o.definition);
    const before = defs.filter((o) => o.order <= order);
    const conf = (o: Occurrence): number => o.definition?.confidence ?? 0;
    // Nearest trusted definition before this point, else the nearest plausible one;
    // then the first plausible one further on; guesses (< PLAUSIBLE) only as a last resort.
    const preceding = before.filter((o) => conf(o) >= TRUSTED).at(-1) ?? before.filter((o) => conf(o) >= PLAUSIBLE).at(-1);
    if (preceding) return { occurrence: preceding, kind: 'preceding' };
    const later = defs.find((o) => o.order > order && conf(o) >= PLAUSIBLE);
    if (later) return { occurrence: later, kind: 'later' };
    const guess = before.at(-1);
    if (guess) return { occurrence: guess, kind: 'preceding' };
    if (defs[0]) return { occurrence: defs[0], kind: 'later' };
    return { occurrence: all[0]!, kind: 'first-use' };
  }
}
