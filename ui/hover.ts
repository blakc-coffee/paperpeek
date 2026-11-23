// One delegated listener set for the whole page: no per-symbol handlers, so
// cost stays flat however many formulas a paper has.

import type { Occurrence, SymbolTable } from '../core/symbol-table';
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
    const occ = occurrenceAt(table, e.target);
    if (!occ) return;
    window.clearTimeout(closeTimer);
    if (popup.anchor === occ.el) return;
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(() => {
      const result = table.lookup(occ.key, occ.order);
      if (result) popup.show(occ.el, result);
    }, OPEN_DELAY_MS);
  };

  const onOut = (e: PointerEvent): void => {
    const to = e.relatedTarget;
    if (to instanceof Node && (popup.host.contains(to) || to === popup.host)) return;
    if (popup.anchor && to instanceof Node && popup.anchor.contains(to)) return;
    if (inPopup(e) || occurrenceAt(table, e.target)) scheduleClose();
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
