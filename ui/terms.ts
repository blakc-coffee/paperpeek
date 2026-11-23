// AI/ML term highlighting without touching the page DOM: matches become Ranges
// painted by the CSS Custom Highlight API, and hover is hit-tested from the
// caret position under the pointer.

import type { GlossaryEntry, TermMatch } from '../core/glossary';

/** Text inside these is never a term: formulas, links, citations, footnotes. */
const SKIP = 'math, a, .ltx_cite, .ltx_note, .ltx_title';
const HIGHLIGHT = 'paperpeek-term';

export interface TermHit {
  range: Range;
  entry: GlossaryEntry;
}

export class TermIndex {
  readonly hits: TermHit[] = [];
  private readonly byNode = new Map<Node, TermHit[]>();

  /** Indexes the first use of each term per section, so the page isn't underlined everywhere. */
  constructor(doc: Document, roots: Iterable<Element>, match: (text: string) => TermMatch[]) {
    const seen = new Set<string>();
    for (const root of roots) {
      const section = root.closest('section[id]')?.id ?? '';
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const m of match(node.textContent ?? '')) {
          const key = `${section}\u0000${m.entry.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const range = doc.createRange();
          range.setStart(node, m.start);
          range.setEnd(node, m.end);
          const hit = { range, entry: m.entry };
          this.hits.push(hit);
          const list = this.byNode.get(node);
          if (list) list.push(hit);
          else this.byNode.set(node, [hit]);
        }
      }
    }
  }

  /** The term under viewport point (x, y) and the line box it sits on. */
  at(doc: Document, x: number, y: number): { hit: TermHit; rect: DOMRect } | undefined {
    const list = this.byNode.get(caretNode(doc, x, y) as Node);
    for (const hit of list ?? []) {
      for (const rect of Array.from(hit.range.getClientRects())) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { hit, rect };
      }
    }
    return undefined;
  }
}

function caretNode(doc: Document, x: number, y: number): Node | null {
  if ('caretPositionFromPoint' in doc) return doc.caretPositionFromPoint(x, y)?.offsetNode ?? null;
  // Older Chromium.
  const legacy = doc as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  return legacy.caretRangeFromPoint?.(x, y)?.startContainer ?? null;
}

/** Underline indexed terms. Returns an undo function. No-op where the Highlight API is missing. */
export function paintTerms(doc: Document, index: TermIndex): () => void {
  if (typeof Highlight === 'undefined' || !('highlights' in CSS)) return () => {};
  CSS.highlights.set(HIGHLIGHT, new Highlight(...index.hits.map((h) => h.range)));
  const style = doc.createElement('style');
  // A faint tint plus dotted underline reads on both light and dark page themes.
  style.textContent = `::highlight(${HIGHLIGHT}) {
    background-color: rgb(59 130 246 / 0.12);
    text-decoration: underline dotted rgb(59 130 246 / 0.9); text-decoration-thickness: 1.5px;
  }`;
  doc.head.appendChild(style);
  return () => {
    CSS.highlights.delete(HIGHLIGHT);
    style.remove();
  };
}
