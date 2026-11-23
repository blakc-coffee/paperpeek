// Popup content. Built with DOM APIs only: page text goes in as text nodes and
// page formulas are cloned and stripped of attributes that could run code.

import type { GlossaryEntry } from '../core/glossary';
import type { LookupResult, Occurrence } from '../core/symbol-table';
import { DIAGRAMS } from '../data/glossary/diagrams';
import { DEMOS } from './demos';

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';
const UNSAFE_ATTR = /^(?:on|href$|xlink:href$|src$|srcset$|style$)/i;
const UNSAFE_TAGS = 'script, style, iframe, object, embed, foreignObject, img, svg';
const MAX_BADGE = 40;

function sanitizedClone(el: Element): Element {
  const clone = el.cloneNode(true) as Element;
  for (const bad of Array.from(clone.querySelectorAll(UNSAFE_TAGS))) bad.remove();
  for (const node of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
    for (const attr of Array.from(node.attributes)) {
      if (UNSAFE_ATTR.test(attr.name)) node.removeAttribute(attr.name);
    }
  }
  clone.removeAttribute('id');
  for (const withId of Array.from(clone.querySelectorAll('[id]'))) withId.removeAttribute('id');
  return clone;
}

/** Wrap a MathML fragment (e.g. an <msub>) in its own <math> so it renders outside the page formula. */
function mathOf(doc: Document, el: Element): Element {
  if (el.localName === 'math') return sanitizedClone(el);
  const math = doc.createElementNS(MATHML_NS, 'math');
  math.appendChild(sanitizedClone(el));
  return math;
}

/** "S3.SS2" → "3.2 Attention", from the LaTeXML section heading. */
export function sectionLabel(doc: Document, sectionId: string | null): string {
  if (!sectionId) return '';
  // LaTeXML: <h3 class="ltx_title">; Wikipedia: <div class="mw-heading"><h2>; plain HTML: a direct heading.
  const title =
    doc.getElementById(sectionId)?.querySelector(':scope > .ltx_title, :scope > .mw-heading > :is(h2, h3, h4), :scope > :is(h2, h3, h4)')
      ?.textContent ?? '';
  const label = title.replace(/\s+/g, ' ').trim();
  return label.length > MAX_BADGE ? `${label.slice(0, MAX_BADGE - 1)}…` : label;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const NOTE: Record<LookupResult['kind'], string> = {
  preceding: 'Quoted from this paper',
  later: 'Defined later in the paper',
  'first-use': 'No definition found — showing first use',
};

export function renderCard(
  doc: Document,
  hovered: Element,
  result: LookupResult,
  onJump: (target: Element) => void,
): HTMLElement {
  const { occurrence, kind } = result;
  const def = occurrence.definition;
  const card = el(doc, 'div', `card ${def ? 'is-defined' : 'is-partial'}`);
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', def ? `Definition: ${def.gloss}` : 'Symbol first use');

  const head = el(doc, 'div', 'head');
  const symbol = el(doc, 'span', 'symbol');
  symbol.appendChild(mathOf(doc, hovered));
  head.append(symbol, el(doc, 'span', 'gloss', def ? def.gloss : 'Not defined in the text'));
  const badge = sectionLabel(doc, occurrence.sectionId);
  if (badge) head.appendChild(el(doc, 'span', 'badge', `§ ${badge}`));
  card.appendChild(head);

  if (def) {
    const quote = el(doc, 'blockquote', 'quote');
    for (const part of def.parts) {
      quote.append(typeof part === 'string' ? doc.createTextNode(part) : mathOf(doc, part));
    }
    card.appendChild(quote);
  }

  const foot = el(doc, 'div', 'foot');
  const JUMP: Record<LookupResult['kind'], string> = {
    preceding: '↑ Jump to definition',
    later: '↓ Jump to definition',
    'first-use': 'Jump to first use',
  };
  const jump = el(doc, 'button', 'jump', JUMP[kind]);
  jump.type = 'button';
  jump.addEventListener('click', () => onJump(occurrence.el));
  foot.append(jump, el(doc, 'span', 'note', NOTE[kind]));
  card.appendChild(foot);
  return card;
}

const MAX_PANELS = 3;

/** A fresh <img> for a page image, only for http(s) URLs; width/height reserve space before it loads. */
function imageOf(doc: Document, img: HTMLImageElement): HTMLImageElement | null {
  let url: URL;
  try {
    url = new URL(img.getAttribute('src') ?? '', doc.baseURI);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const out = doc.createElement('img');
  out.src = url.href;
  out.alt = img.alt === 'Refer to caption' ? '' : img.alt;
  out.decoding = 'async';
  const [w, h] = [img.getAttribute('width'), img.getAttribute('height')];
  if (w && h) {
    out.width = Number(w);
    out.height = Number(h);
  }
  return out;
}

/** "Figure 2: " → "Figure 2", from the LaTeXML caption tag. */
export function figureLabel(figure: Element): string {
  const tag = figure.querySelector(':scope > figcaption .ltx_tag')?.textContent ?? '';
  return tag.replace(/[:.\s]+$/, '').trim() || (figure.matches('.ltx_table') ? 'Table' : 'Figure');
}

/** Preview of a figure or table: its images (or table), caption, and a jump link. */
export function renderFigureCard(
  doc: Document,
  ref: Element,
  figure: Element,
  onJump: (target: Element) => void,
): HTMLElement {
  const label = figureLabel(figure);
  const card = el(doc, 'div', 'card is-figure');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', label);

  const media = el(doc, 'div', 'media');
  if (figure.matches('.ltx_table')) {
    const table = figure.querySelector('table');
    if (table) media.appendChild(sanitizedClone(table)).classList.add('table');
  } else {
    const images = Array.from(figure.querySelectorAll<HTMLImageElement>('img')).slice(0, MAX_PANELS);
    for (const img of images) {
      const copy = imageOf(doc, img);
      if (copy) media.appendChild(copy);
    }
  }
  if (media.childElementCount) card.appendChild(media);

  const caption = figure.querySelector(':scope > figcaption');
  if (caption) {
    const text = el(doc, 'div', 'caption');
    text.append(...Array.from(sanitizedClone(caption).childNodes));
    text.querySelector('.ltx_tag')?.remove();
    card.appendChild(text);
  }

  const below = Boolean(ref.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING);
  const foot = el(doc, 'div', 'foot');
  const jump = el(doc, 'button', 'jump', `${below ? '↓' : '↑'} Jump to ${label}`);
  jump.type = 'button';
  jump.addEventListener('click', () => onJump(figure));
  const badge = sectionLabel(doc, figure.closest('section[id]')?.id ?? null);
  foot.append(jump, el(doc, 'span', 'note', badge ? `§ ${badge}` : 'From this paper'));
  card.appendChild(foot);
  return card;
}

const MAX_FORMULA_ROWS = 8;

export interface FormulaRow {
  occurrence: Occurrence;
  result: LookupResult | undefined;
}

/**
 * Every symbol of a KaTeX/MathJax formula with the definition that applies there. Those
 * renderers draw glyphs as styled spans, so the hovered glyph can't be matched to one symbol.
 */
export function renderFormulaCard(doc: Document, rows: readonly FormulaRow[], onJump: (target: Element) => void): HTMLElement {
  const card = el(doc, 'div', 'card is-formula');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Symbols in this formula');
  const head = el(doc, 'div', 'head');
  head.append(el(doc, 'span', 'term', 'Symbols in this formula'), el(doc, 'span', 'badge', String(rows.length)));
  card.appendChild(head);

  const list = el(doc, 'ul', 'symbols');
  for (const { occurrence, result } of rows.slice(0, MAX_FORMULA_ROWS)) {
    const row = el(doc, 'li', 'row');
    const symbol = el(doc, 'span', 'symbol');
    symbol.appendChild(mathOf(doc, occurrence.el));
    const def = result?.occurrence.definition;
    row.append(symbol, el(doc, 'span', def ? 'gloss-sm' : 'gloss-sm is-missing', def ? def.gloss : 'Not defined in the text'));
    if (def && result) {
      const target = result.occurrence.formula ?? result.occurrence.el;
      const jump = el(doc, 'button', 'jump-sm', result.kind === 'later' ? '↓' : '↑');
      jump.type = 'button';
      jump.setAttribute('aria-label', `Jump to the definition: ${def.gloss}`);
      jump.addEventListener('click', () => onJump(target));
      row.appendChild(jump);
    }
    list.appendChild(row);
  }
  card.appendChild(list);
  const foot = el(doc, 'div', 'foot');
  const extra = rows.length - MAX_FORMULA_ROWS;
  foot.appendChild(el(doc, 'span', 'note', extra > 0 ? `+${extra} more · definitions quoted from this page` : 'Definitions quoted from this page'));
  card.appendChild(foot);
  return card;
}

/** An AI/ML term from the bundled glossary: explanation, formula, diagram, source. */
export function renderTermCard(doc: Document, entry: GlossaryEntry, onResize: () => void = () => {}): HTMLElement {
  const card = el(doc, 'div', 'card is-term');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', `AI/ML term: ${entry.term}`);
  const head = el(doc, 'div', 'head');
  head.append(el(doc, 'span', 'term', entry.term), el(doc, 'span', 'badge', 'AI/ML term'));
  card.append(head, el(doc, 'p', 'short', entry.short));
  if (entry.formula) card.appendChild(el(doc, 'div', 'formula', entry.formula));
  const svg = entry.diagram ? DIAGRAMS[entry.diagram] : undefined;
  const diagram = el(doc, 'div', 'diagram');
  if (svg) {
    // Our own bundled markup, parsed as XML (never page content).
    diagram.appendChild(doc.importNode(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement, true));
    card.appendChild(diagram);
  }
  const foot = el(doc, 'div', 'foot');
  const build = entry.demo ? DEMOS[entry.demo] : undefined;
  if (build) {
    // The demo is built on first press only; the static diagram comes back on "Hide demo".
    let demo: HTMLElement | null = null;
    const toggle = el(doc, 'button', 'jump', '▶ Try it');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const opening = !demo?.parentNode;
      if (opening) {
        demo ??= build(doc);
        diagram.remove();
        foot.before(demo);
      } else {
        demo?.remove();
        if (svg) foot.before(diagram);
      }
      toggle.textContent = opening ? 'Hide demo' : '▶ Try it';
      toggle.setAttribute('aria-expanded', String(opening));
      onResize();
    });
    foot.appendChild(toggle);
  }
  const credit = `${entry.source ?? 'PaperPeek glossary'} · ${entry.license ?? 'CC BY 4.0'}`;
  if (entry.url?.startsWith('https://')) {
    const link = el(doc, 'a', 'note', credit);
    link.href = entry.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    foot.appendChild(link);
  } else {
    foot.appendChild(el(doc, 'span', 'note', credit));
  }
  card.appendChild(foot);
  return card;
}
