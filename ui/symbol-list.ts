// Data for the symbol glossary side panel: one row per symbol on the page,
// in reading order, with the definition that applies at its first use.

import type { SymbolTable } from '../core/symbol-table';
import { sectionLabel } from './card';

export const SYMBOLS_MESSAGE = 'paperpeek:symbols';
export const JUMP_MESSAGE = 'paperpeek:jump';

export interface SymbolRow {
  key: string;
  /** null when the paper never defines it. */
  gloss: string | null;
  /** Source sentence with formulas as $TeX$; empty when undefined. */
  sentence: string;
  section: string;
  count: number;
  /** Document order of the occurrence to jump to: the definition if any, else the first use. */
  order: number;
}

export function symbolRows(doc: Document, table: SymbolTable): SymbolRow[] {
  const rows = table.keys.map((key) => {
    const uses = table.occurrences(key);
    const first = uses[0]!;
    const result = table.lookup(key, first.order);
    const def = result?.occurrence.definition;
    const target = def ? result!.occurrence : first;
    return {
      key,
      gloss: def?.gloss ?? null,
      sentence: def?.sentence ?? '',
      section: sectionLabel(doc, target.sectionId),
      count: uses.length,
      order: target.order,
    };
  });
  return rows.sort((a, b) => a.order - b.order);
}
