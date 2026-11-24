// One delegated listener set for the whole page: no per-symbol, per-link or
// per-term handlers, so cost stays flat however long the paper is. Pointer
// moves are coalesced to one hit-test per animation frame.

import type { Occurrence, SymbolTable } from '../core/symbol-table';
import { renderCard, renderCitationCard, renderEquationCard, renderFigureCard, renderFormulaCard, renderTermCard } from './card';
import type { Popup } from './popup';
import type { TermIndex } from './terms';
import { clearUses, showUses } from './uses';

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

/** The symbol occurrence under `target`, climbing from the hovered glyph up to its <math>. */
export function occurrenceAt(table: SymbolTable, target: EventTarget | null): Occurrence | undefined {
  let node = target instanceof Element ? target : null;
  while (node) {
    const occ = table.byElement.get(node);
    if (occ) return occ;
    if (node.localName === 'math') return undefined;
    node = node.parentElement;
  }
  return undefined;
}

/** The KaTeX/MathJax formula under `target` and its symbols, climbing from the hovered glyph. */
export function formulaAt(table: SymbolTable, target: EventTarget | null): { el: Element; occurrences: Occurrence[] } | undefined {
  for (let node = target instanceof Element ? target : null; node; node = node.parentElement) {
    const occurrences = table.byFormula.get(node);
    if (occurrences) return { el: node, occurrences };
  }
  return undefined;
}

/** A cross-reference link under `target` that points at a figure or table on this page. */
export type CrossRefKind = 'figure' | 'equation' | 'citation';

const CROSS_REF_TARGETS: Array<[CrossRefKind, string]> = [
  ['figure', 'figure.ltx_figure, figure.ltx_table'],
  ['equation', 'table.ltx_equation, table.ltx_equationgroup, .ltx_equationgroup'],
  ['citation', 'li.ltx_bibitem'],
];

/** A LaTeXML cross-reference link under `target` and what it points at on this page. */
export function crossRefAt(
  doc: Document,
  target: EventTarget | null,
): { ref: Element; target: Element; kind: CrossRefKind } | undefined {
  const ref = target instanceof Element ? target.closest('a.ltx_ref[href^="#"]') : null;
  if (!ref) return undefined;
  const el = doc.getElementById(ref.getAttribute('href')?.slice(1) ?? '');
  if (!el || el.contains(ref)) return undefined;
  const kind = CROSS_REF_TARGETS.find(([, selector]) => el.matches(selector))?.[0];
  return kind && { ref, target: el, kind };
}

/** A cross-reference link to a figure or table (kept for callers that only want figures). */
export function figureRefAt(doc: Document, target: EventTarget | null): { ref: Element; figure: Element } | undefined {
  const hit = crossRefAt(doc, target);
  return hit?.kind === 'figure' ? { ref: hit.ref, figure: hit.target } : undefined;
}

export interface HoverSources {
  table: SymbolTable;
  terms: TermIndex;
}

interface Hit {
  anchor: object;
  rect: () => DOMRectReadOnly;
  card: () => HTMLElement | undefined;
}

/** The element and viewport point at the start of the current selection or caret, if any. */
export function caretPoint(doc: Document): { target: Element; x: number; y: number } | undefined {
  const selection = doc.getSelection();
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  const target = node instanceof Element ? node : node.parentElement;
  if (!target) return undefined;
  // A collapsed caret has no box of its own; fall back to its element's box.
  const rect = range.getClientRects()[0] ?? target.getBoundingClientRect();
  return { target, x: rect.left + Math.min(2, rect.width / 2), y: rect.top + rect.height / 2 };
}

function hitAt(doc: Document, { table, terms }: HoverSources, popup: Popup, target: EventTarget | null, x: number, y: number): Hit | undefined {
  const jump = (to: Element): void => popup.jumpTo(to);
  const occ = occurrenceAt(table, target);
  if (occ) {
    return {
      anchor: occ.el,
      rect: () => occ.el.getBoundingClientRect(),
      card: () => {
        const result = table.lookup(occ.key, occ.order);
        const all = table.occurrences(occ.key);
        const uses = { count: all.length, onShow: () => void showUses(doc, all.map((o) => o.formula ?? o.el)) };
        return result && renderCard(doc, occ.el, result, jump, uses);
      },
    };
  }
  const formula = formulaAt(table, target);
  if (formula) {
    return {
      anchor: formula.el,
      rect: () => formula.el.getBoundingClientRect(),
      card: () => {
        const seen = new Set<string>();
        const rows = formula.occurrences
          .filter((o) => !seen.has(o.key) && Boolean(seen.add(o.key)))
          .map((o) => ({ occurrence: o, result: table.lookup(o.key, o.order) }));
        return renderFormulaCard(doc, rows, jump);
      },
    };
  }
  const xref = crossRefAt(doc, target);
  if (xref) {
    const render = { figure: renderFigureCard, equation: renderEquationCard, citation: renderCitationCard }[xref.kind];
    return { anchor: xref.ref, rect: () => xref.ref.getBoundingClientRect(), card: () => render(doc, xref.ref, xref.target, jump) };
  }
  const term = terms.at(doc, x, y);
  return term && { anchor: term.hit, rect: () => term.rect, card: () => renderTermCard(doc, term.hit.entry, () => popup.relayout()) };
}

export function attachHover(doc: Document, sources: HoverSources, popup: Popup): () => void {
  let openTimer = 0;
  let closeTimer = 0;
  let pending: object | null = null;
  let frame = 0;
  let last: { inPopup: boolean; target: EventTarget | null; x: number; y: number } | null = null;

  const cancelOpen = (): void => {
    window.clearTimeout(openTimer);
    pending = null;
  };
  const keepOpen = (): void => {
    window.clearTimeout(closeTimer);
    closeTimer = 0;
  };
  const scheduleClose = (): void => {
    if (!popup.isOpen || popup.sticky || closeTimer) return;
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      popup.hide();
    }, CLOSE_DELAY_MS);
  };

  const track = (): void => {
    frame = 0;
    if (!last) return;
    const { inPopup, target, x, y } = last;
    if (inPopup) {
      cancelOpen();
      keepOpen();
      return;
    }
    const hit = hitAt(doc, sources, popup, target, x, y);
    if (!hit) {
      cancelOpen();
      scheduleClose();
      return;
    }
    if (hit.anchor === popup.anchor) {
      cancelOpen();
      keepOpen();
      return;
    }
    if (hit.anchor === pending) return;
    cancelOpen();
    pending = hit.anchor;
    openTimer = window.setTimeout(() => {
      pending = null;
      clearUses();
      const card = hit.card();
      if (!card) return;
      keepOpen();
      popup.show(hit.anchor, hit.rect(), card);
    }, OPEN_DELAY_MS);
  };

  const onMove = (e: PointerEvent): void => {
    // composedPath() is only valid during dispatch, so read it now.
    last = { inPopup: e.composedPath().includes(popup.host), target: e.target, x: e.clientX, y: e.clientY };
    if (!frame) frame = requestAnimationFrame(track);
  };

  const onLeave = (e: PointerEvent): void => {
    if (e.relatedTarget === null) {
      cancelOpen();
      scheduleClose();
    }
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      clearUses();
      if (popup.isOpen) popup.hide(true);
    }
    // Alt+Shift+P: explain whatever sits at the text caret or selection (keyboard and caret-browsing users).
    if (e.altKey && e.shiftKey && e.code === 'KeyP') {
      const at = caretPoint(doc);
      const hit = at && hitAt(doc, sources, popup, at.target, at.x, at.y);
      if (hit) clearUses();
      const card = hit?.card();
      if (!hit || !card) return;
      e.preventDefault();
      cancelOpen();
      keepOpen();
      popup.show(hit.anchor, hit.rect(), card, true, true);
    }
  };

  const onDown = (e: PointerEvent): void => {
    if (popup.isOpen && !e.composedPath().includes(popup.host)) popup.hide();
  };

  const onScroll = (): void => {
    if (popup.isOpen) popup.hide();
  };

  doc.addEventListener('pointermove', onMove, { passive: true });
  doc.addEventListener('pointerout', onLeave);
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('pointerdown', onDown, true);
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    cancelOpen();
    keepOpen();
    doc.removeEventListener('pointermove', onMove);
    doc.removeEventListener('pointerout', onLeave);
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('scroll', onScroll);
  };
}
