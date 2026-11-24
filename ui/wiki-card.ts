// Popup states for a selected term that is not in the bundled glossary.

import type { WikiSummary } from '../core/wiki';
import { el } from './card';

export type WikiState =
  | { s: 'ask'; term: string; onLookup: () => void }
  | { s: 'consent'; term: string; onAllow: () => void }
  | { s: 'loading'; term: string }
  | { s: 'ok'; term: string; summary: WikiSummary }
  | { s: 'missing'; term: string }
  | { s: 'error'; term: string; retry: () => void };

function shell(doc: Document, title: string, className: string): { card: HTMLElement; foot: HTMLElement } {
  const card = el(doc, 'div', `card is-wiki ${className}`);
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', title);
  const head = el(doc, 'div', 'head');
  head.append(el(doc, 'span', 'term', title), el(doc, 'span', 'badge', 'Wikipedia'));
  card.appendChild(head);
  return { card, foot: el(doc, 'div', 'foot') };
}

function button(doc: Document, label: string, onClick: () => void): HTMLButtonElement {
  const b = el(doc, 'button', 'jump', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export function renderWikiCard(doc: Document, state: WikiState): HTMLElement {
  const title = state.s === 'ok' ? state.summary.title : state.term;
  const { card, foot } = shell(doc, title, `is-${state.s}`);
  switch (state.s) {
    case 'ask':
      card.appendChild(el(doc, 'p', 'short', 'Not in the PaperPeek glossary.'));
      foot.append(button(doc, 'Look up on Wikipedia', state.onLookup), el(doc, 'span', 'note', 'Sends only this term'));
      break;
    case 'consent':
      card.appendChild(el(doc, 'p', 'short', 'Not in the PaperPeek glossary. Firefox asks you first before PaperPeek sends a term to Wikipedia.'));
      foot.append(button(doc, 'Allow in settings', state.onAllow), el(doc, 'span', 'note', 'Only selected terms are sent'));
      break;
    case 'loading':
      card.setAttribute('aria-busy', 'true');
      card.appendChild(el(doc, 'div', 'skeleton'));
      foot.appendChild(el(doc, 'span', 'note', 'Looking up on Wikipedia…'));
      break;
    case 'missing':
      card.appendChild(el(doc, 'p', 'short', 'No Wikipedia article found for this term.'));
      break;
    case 'error':
      card.appendChild(el(doc, 'p', 'short', 'Could not reach Wikipedia.'));
      foot.appendChild(button(doc, 'Retry', state.retry));
      break;
    case 'ok': {
      const { summary } = state;
      const text = el(doc, 'p', 'extract');
      if (summary.thumbnail) {
        const img = el(doc, 'img', 'thumb');
        img.src = summary.thumbnail.src;
        img.width = summary.thumbnail.width;
        img.height = summary.thumbnail.height;
        img.alt = '';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        card.appendChild(img);
      }
      if (summary.closest) card.appendChild(el(doc, 'p', 'note', `Closest article for “${state.term}”`));
      text.textContent = summary.extract;
      card.appendChild(text);
      const link = el(doc, 'a', 'note', 'Read on Wikipedia');
      link.href = summary.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const credit = summary.thumbnail ? 'Text: Wikipedia, CC BY-SA 4.0 · image: Wikimedia Commons' : 'Text: Wikipedia, CC BY-SA 4.0';
      foot.append(link, el(doc, 'span', 'note', credit));
      break;
    }
  }
  if (foot.childElementCount) card.appendChild(foot);
  return card;
}
