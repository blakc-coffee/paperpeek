// One popup per tab: a closed shadow root (page CSS can't reach it, ours can't
// leak) holding a native popover in the top layer (no z-index fights).

import { place } from './place';

const ENTER_MS = 150;
const EXIT_MS = 100;

const DARK = `
  --bg: #1f2430; --fg: #f3f4f6; --muted: #9ca3af; --accent: #93c5fd;
  --accent-bg: rgb(147 197 253 / 0.12); --quote: #3b82f6; --border: rgb(255 255 255 / 0.10);
  --shadow: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 8px 24px rgb(0 0 0 / 0.5);`;

/** Sites with their own theme switch (arXiv: <html data-theme="dark">) override the OS setting. */
function pageTheme(doc: Document): 'theme-dark' | 'theme-light' | null {
  const theme = doc.documentElement.dataset.theme;
  return theme === 'dark' ? 'theme-dark' : theme === 'light' ? 'theme-light' : null;
}

const STYLE = `
:host { all: initial; }
.panel {
  position: fixed; inset: auto; margin: 0; padding: 0; border: 0;
  background: transparent; overflow: visible; color-scheme: light dark;
}
.card {
  --bg: #ffffff; --fg: #111827; --muted: #6b7280; --accent: #2563eb;
  --accent-bg: #eff6ff; --quote: #93c5fd; --border: rgb(0 0 0 / 0.08);
  --shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.12);
  box-sizing: border-box; width: max-content; max-width: min(380px, calc(100vw - 32px));
  padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border);
  background: var(--bg); color: var(--fg); box-shadow: var(--shadow);
  font: 400 14px/20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  opacity: 0; transform: translateY(-2px) scale(0.96);
  transition: opacity ${ENTER_MS}ms cubic-bezier(0.23, 1, 0.32, 1), transform ${ENTER_MS}ms cubic-bezier(0.23, 1, 0.32, 1);
}
.panel.above .card { transform: translateY(2px) scale(0.96); transform-origin: bottom center; }
.panel.below .card { transform-origin: top center; }
.panel.open .card { opacity: 1; transform: none; }
.panel.closing .card { transition-duration: ${EXIT_MS}ms; }
@media (prefers-color-scheme: dark) { .panel:not(.theme-light) .card { ${DARK} } }
.panel.theme-dark .card { ${DARK} }
@media (prefers-reduced-motion: reduce) {
  .card, .panel.above .card { transform: none; transition: opacity 100ms linear; }
}
.head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.symbol { color: var(--accent); font-size: 16px; line-height: 24px; }
.symbol math { font-size: 1.15em; }
.gloss { font-weight: 600; font-size: 16px; line-height: 24px; letter-spacing: -0.01em; }
.is-partial .gloss { font-weight: 500; color: var(--muted); }
.badge {
  margin-left: auto; padding: 0 8px; border-radius: 999px; white-space: nowrap;
  background: var(--accent-bg); color: var(--accent); font-size: 12px; line-height: 20px; font-weight: 500;
}
.quote {
  margin: 8px 0 0; padding: 0 0 0 12px; border-left: 3px solid var(--quote);
  color: var(--fg); font-style: italic; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
.foot { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.jump {
  all: unset; cursor: pointer; padding: 6px 12px; margin-left: -12px; border-radius: 8px;
  color: var(--accent); font-weight: 600; font-size: 14px; line-height: 20px;
  transition: background-color 100ms cubic-bezier(0.23, 1, 0.32, 1), transform 100ms cubic-bezier(0.23, 1, 0.32, 1);
}
@media (hover: hover) { .jump:hover { background: var(--accent-bg); } }
.jump:active { transform: scale(0.98); }
.jump:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.note { color: var(--muted); font-size: 12px; line-height: 16px; }
.symbols { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }
.symbols .row { display: grid; grid-template-columns: minmax(40px, auto) 1fr auto; gap: 10px; align-items: center; min-height: 28px; }
.symbols .symbol { font-size: 15px; line-height: 20px; }
.gloss-sm { font-size: 14px; line-height: 20px; overflow-wrap: anywhere; }
.gloss-sm.is-missing { color: var(--muted); }
.jump-sm {
  all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 8px; text-align: center; line-height: 28px;
  color: var(--accent); font-weight: 600;
  transition: background-color 100ms cubic-bezier(0.23, 1, 0.32, 1), transform 100ms cubic-bezier(0.23, 1, 0.32, 1);
}
@media (hover: hover) { .jump-sm:hover { background: var(--accent-bg); } }
.jump-sm:active { transform: scale(0.98); }
.jump-sm:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.is-figure { width: min(440px, calc(100vw - 32px)); max-width: none; }
.media { display: flex; gap: 8px; justify-content: center; align-items: flex-end; }
.media img {
  min-width: 0; max-width: 100%; width: auto; height: auto; max-height: 240px;
  border-radius: 6px; background: #ffffff; object-fit: contain;
}
.media .table {
  display: block; max-height: 240px; overflow: auto; border-collapse: collapse;
  font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums;
}
.media .table td, .media .table th { padding: 2px 6px; white-space: nowrap; }
.term { color: var(--accent); font-weight: 600; font-size: 16px; line-height: 24px; letter-spacing: -0.01em; }
.short { margin: 4px 0 0; }
.formula {
  margin-top: 8px; padding: 4px 8px; border-radius: 6px; background: var(--accent-bg); overflow-x: auto; white-space: nowrap;
  font: italic 15px/22px "Cambria Math", "STIX Two Math", "Latin Modern Math", Georgia, serif;
}
.diagram { margin-top: 8px; }
.diagram svg { display: block; width: 100%; height: auto; }
.d-box { fill: var(--accent-bg); stroke: var(--accent); }
.d-text { fill: var(--fg); font: 11px system-ui, sans-serif; }
.d-line { stroke: var(--muted); stroke-width: 1.25; }
.d-head, .d-bar { fill: var(--accent); }
.d-node { fill: var(--accent-bg); stroke: var(--accent); }
.d-off { fill: none; stroke: var(--muted); stroke-dasharray: 2 2; }
.d-curve, .d-curve2, .d-curve3 { fill: none; stroke-width: 2; }
.d-curve { stroke: var(--accent); }
.d-curve2 { stroke: #f59e0b; }
.d-curve3 { stroke: #10b981; }
.d-dot.d-curve { fill: var(--accent); }
.d-dot.d-curve2 { fill: #f59e0b; }
.d-dot.d-curve3 { fill: #10b981; }
.d-thin { fill: none; stroke-dasharray: 3 3; }
.d-small { font-size: 9px; }
.demo { margin-top: 8px; }
.demo svg { display: block; width: 100%; height: auto; }
.control { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 12px; line-height: 16px; color: var(--muted); }
.control > span:first-child { flex: 0 0 104px; }
.control input { flex: 1; min-width: 0; accent-color: var(--accent); }
.control output { min-width: 56px; text-align: right; color: var(--fg); font-variant-numeric: tabular-nums; }
.chip {
  all: unset; cursor: pointer; margin-top: 4px; padding: 2px 10px; border-radius: 999px; font-size: 12px; line-height: 20px;
  background: var(--accent-bg); color: var(--accent); font-weight: 500;
  transition: transform 100ms cubic-bezier(0.23, 1, 0.32, 1);
}
.chip:active { transform: scale(0.98); }
.chip:focus-visible, .control input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.thumb { float: right; margin: 0 0 8px 12px; max-width: 96px; max-height: 96px; width: auto; height: auto; border-radius: 6px; background: #ffffff; }
.extract { margin: 4px 0 0; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.foot a { color: var(--accent); }
.is-wiki .foot { clear: both; flex-wrap: wrap; }
.skeleton { height: 60px; margin-top: 8px; border-radius: 6px; background: var(--accent-bg); }
.caption {
  margin-top: 8px; color: var(--fg); overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
`;

export class Popup {
  readonly host: HTMLElement;
  private readonly panel: HTMLElement;
  private closeTimer = 0;
  private anchorRect: DOMRectReadOnly | null = null;
  /** Identity of what the popup is showing (a symbol element or a term hit). */
  anchor: object | null = null;
  /** Sticky popups (opened from a text selection) ignore pointer movement; Esc, click outside or scroll close them. */
  sticky = false;

  constructor(private readonly doc: Document) {
    this.host = doc.createElement('paperpeek-popup');
    const root = this.host.attachShadow({ mode: 'closed' });
    const style = doc.createElement('style');
    style.textContent = STYLE;
    this.panel = doc.createElement('div');
    this.panel.className = 'panel';
    this.panel.setAttribute('popover', 'manual');
    root.append(style, this.panel);
    doc.documentElement.appendChild(this.host);
  }

  get isOpen(): boolean {
    return this.anchor !== null;
  }

  show(anchor: object, anchorRect: DOMRectReadOnly, card: HTMLElement, sticky = false): void {
    window.clearTimeout(this.closeTimer);
    this.anchor = anchor;
    this.sticky = sticky;
    this.anchorRect = anchorRect;
    this.panel.classList.remove('open', 'closing', 'theme-dark', 'theme-light');
    const theme = pageTheme(this.doc);
    if (theme) this.panel.classList.add(theme);
    this.panel.replaceChildren(card);
    if (!this.panel.matches(':popover-open')) this.panel.showPopover();
    this.relayout();
    // Next frame so the enter transition runs from the initial state.
    requestAnimationFrame(() => this.panel.classList.add('open'));
  }

  /** Swap the content of the open card in place (e.g. loading → result) and re-place it. */
  replace(card: HTMLElement): void {
    if (!this.anchor) return;
    this.panel.replaceChildren(card);
    this.relayout();
  }

  /** Re-place the open card against its anchor, e.g. after a demo changed its height. */
  relayout(): void {
    const card = this.panel.firstElementChild as HTMLElement | null;
    if (!card || !this.anchorRect) return;
    const { left, top, side } = place(
      this.anchorRect,
      { width: card.offsetWidth, height: card.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    this.panel.style.left = `${left}px`;
    this.panel.style.top = `${top}px`;
    this.panel.classList.remove('above', 'below');
    this.panel.classList.add(side);
  }

  hide(): void {
    if (!this.anchor) return;
    this.anchor = null;
    this.panel.classList.add('closing');
    this.panel.classList.remove('open');
    this.closeTimer = window.setTimeout(() => {
      if (this.panel.matches(':popover-open')) this.panel.hidePopover();
      this.panel.classList.remove('closing');
    }, EXIT_MS);
  }

  jumpTo(target: Element): void {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const formula = target.closest('math') ?? target;
    this.hide();
    formula.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    formula.animate(
      [{ backgroundColor: 'rgb(37 99 235 / 0.25)' }, { backgroundColor: 'rgb(37 99 235 / 0)' }],
      { duration: 1600, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }
}
