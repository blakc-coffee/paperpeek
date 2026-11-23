// One delegated listener set for the whole page: no per-symbol or per-link
// handlers, so cost stays flat however many formulas and references a paper has.

import type { Occurrence, SymbolTable } from '../core/symbol-table';
import { renderCard, renderFigureCard } from './card';
import type { Popup } from './popup';

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

/** A cross-reference link under `target` that points at a figure or table on this page. */
export function figureRefAt(doc: Document, target: EventTarget | null): { ref: Element; figure: Element } | undefined {
  const ref = target instanceof Element ? target.closest('a.ltx_ref[href^="#"]') : null;
  if (!ref) return undefined;
  const figure = doc.getElementById(ref.getAttribute('href')?.slice(1) ?? '');
  if (!figure?.matches('figure.ltx_figure, figure.ltx_table') || figure.contains(ref)) return undefined;
  return { ref, figure };
}

/** What a hover over `target` should show: the anchor element and a card builder. */
function hitAt(
  doc: Document,
  table: SymbolTable,
  popup: Popup,
  target: EventTarget | null,
): { anchor: Element; card: () => HTMLElement | undefined } | undefined {
  const jump = (to: Element): void => popup.jumpTo(to);
  const occ = occurrenceAt(table, target);
  if (occ) {
    return {
      anchor: occ.el,
      card: () => {
        const result = table.lookup(occ.key, occ.order);
        return result && renderCard(doc, occ.el, result, jump);
      },
    };
  }
  const fig = figureRefAt(doc, target);
  return fig && { anchor: fig.ref, card: () => renderFigureCard(doc, fig.ref, fig.figure, jump) };
}

export function attachHover(doc: Document, table: SymbolTable, popup: Popup): () => void {
  let openTimer = 0;
  let closeTimer = 0;
  const inPopup = (e: Event): boolean => e.composedPath().includes(popup.host);

  const scheduleClose = (): void => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => popup.hide(), CLOSE_DELAY_MS);
  };

  const onOver = (e: PointerEvent): void => {
    if (inPopup(e)) {
      window.clearTimeout(closeTimer);
      return;
    }
    const hit = hitAt(doc, table, popup, e.target);
    if (!hit) return;
    window.clearTimeout(closeTimer);
    if (popup.anchor === hit.anchor) return;
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(() => {
      const card = hit.card();
      if (card) popup.show(hit.anchor, card);
    }, OPEN_DELAY_MS);
  };

  const onOut = (e: PointerEvent): void => {
    const to = e.relatedTarget;
    if (to instanceof Node && (popup.host.contains(to) || to === popup.host)) return;
    if (popup.anchor && to instanceof Node && popup.anchor.contains(to)) return;
    if (inPopup(e) || hitAt(doc, table, popup, e.target)) scheduleClose();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && popup.isOpen) popup.hide();
  };

  const onDown = (e: PointerEvent): void => {
    if (popup.isOpen && !inPopup(e)) popup.hide();
  };

  const onScroll = (): void => {
    if (popup.isOpen) popup.hide();
  };

  doc.addEventListener('pointerover', onOver);
  doc.addEventListener('pointerout', onOut);
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('pointerdown', onDown, true);
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    doc.removeEventListener('pointerover', onOver);
    doc.removeEventListener('pointerout', onOut);
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('scroll', onScroll);
  };
}
