// Which definition applies where. Papers reuse and redefine symbols, so a
// lookup is position-aware: the nearest definition *before* the hovered
// occurrence wins (ScholarPhi, Head et al. CHI 2021).

export interface DefinitionInfo {
  gloss: string;
  confidence: number;
  /** Source sentence, shown in the popup so the reader can judge it. */
  sentence: string;
}

export interface Occurrence {
  key: string;
  /** Document order across all symbol occurrences. */
  order: number;
  mathId: string;
  sectionId: string | null;
  el: Element;
  definition?: DefinitionInfo;
}

export type LookupKind = 'preceding' | 'later' | 'first-use';

export interface LookupResult {
  occurrence: Occurrence;
  kind: LookupKind;
}

/** Definitions at or above this confidence beat a closer, weaker one. */
const TRUSTED = 0.7;

export class SymbolTable {
  private readonly byKey = new Map<string, Occurrence[]>();
  readonly byElement = new Map<Element, Occurrence>();

  constructor(occurrences: Occurrence[]) {
    for (const occ of [...occurrences].sort((a, b) => a.order - b.order)) {
      const list = this.byKey.get(occ.key);
      if (list) list.push(occ);
      else this.byKey.set(occ.key, [occ]);
      this.byElement.set(occ.el, occ);
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
    const trusted = before.filter((o) => (o.definition?.confidence ?? 0) >= TRUSTED);
    const preceding = trusted.at(-1) ?? before.at(-1);
    if (preceding) return { occurrence: preceding, kind: 'preceding' };
    const later = defs[0];
    if (later) return { occurrence: later, kind: 'later' };
    return { occurrence: all[0]!, kind: 'first-use' };
  }
}
