// Popup content. Built with DOM APIs only: page text goes in as text nodes and
// page formulas are cloned and stripped of attributes that could run code.

import type { LookupResult } from '../core/symbol-table';

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
  const title = doc.getElementById(sectionId)?.querySelector(':scope > .ltx_title')?.textContent ?? '';
  const label = title.replace(/\s+/g, ' ').trim();
  return label.length > MAX_BADGE ? `${label.slice(0, MAX_BADGE - 1)}…` : label;
}

function el<K extends keyof HTMLElementTagNameMap>(
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
