// Select a word or short phrase to look it up: bundled glossary first, then
// (if the reader allows it) Wikipedia. Selection popups are sticky so reading
// them doesn't require holding the pointer still.

import type { GlossaryEntry, TermMatch } from '../core/glossary';
import type { WikiSummary } from '../core/wiki';
import { renderTermCard } from './card';
import type { Popup } from './popup';
import { renderWikiCard } from './wiki-card';

export type WikiMode = 'ask' | 'always' | 'never';

export interface LookupDeps {
  match: (text: string) => TermMatch[];
  popup: Popup;
  mode: () => Promise<WikiMode>;
  wikipedia: (term: string) => Promise<WikiSummary | null>;
}

const MAX_WORDS = 5;

/** The selected phrase if it is worth looking up: 3–60 characters, ≤ 5 words, some letters, not inside a formula. */
export function lookupText(selection: Selection | null): string | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const text = selection.toString().replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');
  if (text.length < 3 || text.length > 60 || text.split(' ').length > MAX_WORDS || !/\p{L}{2}/u.test(text)) return null;
  const node = selection.getRangeAt(0).commonAncestorContainer;
  const element = node instanceof Element ? node : node.parentElement;
  if (element?.closest('math, input, textarea, [contenteditable=""], [contenteditable="true"]')) return null;
  return text;
}

/** A glossary entry only when one term covers the whole selection. */
export function glossaryEntryFor(text: string, match: (text: string) => TermMatch[]): GlossaryEntry | undefined {
  const [only, ...rest] = match(text);
  return only && rest.length === 0 && only.start === 0 && only.end === text.length ? only.entry : undefined;
}

export function attachLookup(doc: Document, deps: LookupDeps): () => void {
  const { popup } = deps;

  const show = async (term: string, range: Range): Promise<void> => {
    const rect = range.getBoundingClientRect();
    const anchor = {};
    const entry = glossaryEntryFor(term, deps.match);
    if (entry) {
      popup.show(anchor, rect, renderTermCard(doc, entry, () => popup.relayout()), true);
      return;
    }
    const mode = await deps.mode();
    if (mode === 'never') return;

    const fetchInto = async (): Promise<void> => {
      if (popup.anchor !== anchor) popup.show(anchor, rect, renderWikiCard(doc, { s: 'loading', term }), true);
      else popup.replace(renderWikiCard(doc, { s: 'loading', term }));
      try {
        const summary = await deps.wikipedia(term);
        if (popup.anchor !== anchor) return; // closed or replaced meanwhile
        popup.replace(renderWikiCard(doc, summary ? { s: 'ok', term, summary } : { s: 'missing', term }));
      } catch {
        if (popup.anchor === anchor) popup.replace(renderWikiCard(doc, { s: 'error', term, retry: () => void fetchInto() }));
      }
    };

    if (mode === 'always') await fetchInto();
    else popup.show(anchor, rect, renderWikiCard(doc, { s: 'ask', term, onLookup: () => void fetchInto() }), true);
  };

  const onUp = (e: PointerEvent): void => {
    if (e.button !== 0 || e.composedPath().includes(popup.host)) return;
    // Let the browser finish updating the selection (double-click selects a word on pointerup).
    window.setTimeout(() => {
      const selection = doc.getSelection();
      const term = lookupText(selection);
      if (term && selection) void show(term, selection.getRangeAt(0));
    }, 0);
  };

  doc.addEventListener('pointerup', onUp);
  return () => doc.removeEventListener('pointerup', onUp);
}
