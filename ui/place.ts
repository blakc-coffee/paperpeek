export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Placement {
  left: number;
  top: number;
  side: 'below' | 'above';
}

const GAP = 8;
const MARGIN = 16;

/**
 * Viewport position for a popup of `size` next to `anchor`: below when it
 * fits, otherwise on whichever side has more room; centred on the anchor and
 * clamped so it never leaves the viewport horizontally.
 */
export function place(
  anchor: Rect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): Placement {
  const roomBelow = viewport.height - anchor.bottom - GAP;
  const roomAbove = anchor.top - GAP;
  const side = roomBelow >= size.height || roomBelow >= roomAbove ? 'below' : 'above';
  const top = side === 'below' ? anchor.bottom + GAP : anchor.top - GAP - size.height;
  const centre = (anchor.left + anchor.right) / 2;
  const maxLeft = Math.max(MARGIN, viewport.width - size.width - MARGIN);
  const left = Math.min(Math.max(centre - size.width / 2, MARGIN), maxLeft);
  return { left: Math.round(left), top: Math.round(Math.max(top, MARGIN)), side };
}
