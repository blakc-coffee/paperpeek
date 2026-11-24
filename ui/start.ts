// Boots PaperPeek on a page: symbol table, term highlights, hover and
// selection lookups. Shared by the arXiv content script and the one that runs
// on sites the reader enabled.

import { browser } from 'wxt/browser';
import { extractOccurrences, type SiteProfile } from '../adapters/arxiv-html';
import { CONSENT_MESSAGE, effectiveMode, OPEN_OPTIONS_MESSAGE } from '../core/consent';
import { compileMatcher } from '../core/glossary';
import { SymbolTable } from '../core/symbol-table';
import { cached, lookupWikipedia } from '../core/wiki';
import glossary from '../data/glossary/core.json';
import generated from '../data/glossary/generated.json';
import { attachHover } from './hover';
import { attachLookup, type WikiMode } from './lookup';
import { Popup } from './popup';
import { paintTerms, TermIndex } from './terms';
import { JUMP_MESSAGE, SYMBOLS_MESSAGE, symbolRows } from './symbol-list';

/** Returns a teardown function. */
export function startPaperPeek(doc: Document, profile: SiteProfile): () => void {
  const start = performance.now();
  const table = new SymbolTable(extractOccurrences(doc, profile));
  // Only the hand-written core terms are highlighted; the generated entries
  // (ADictML, Wikidata) answer when the reader selects a phrase.
  const roots = Array.from(doc.querySelectorAll(profile.prose)).filter((b) => !b.parentElement?.closest(profile.prose));
  const terms = new TermIndex(doc, roots, compileMatcher(glossary.entries));
  const unpaint = paintTerms(doc, terms);
  const popup = new Popup(doc);
  const detachHover = attachHover(doc, { table, terms }, popup);
  const detachLookup = attachLookup(doc, {
    match: compileMatcher([...glossary.entries, ...generated.entries]),
    popup,
    // Wikipedia is opt-in: 'ask' (default) asks before each lookup.
    // On Firefox the reader must also grant the optional searchTerms data collection.
    mode: async () =>
      effectiveMode(
        ((await browser.storage.local.get('wikipedia')).wikipedia as WikiMode | undefined) ?? 'ask',
        import.meta.env.FIREFOX,
        async () => (await browser.runtime.sendMessage(CONSENT_MESSAGE)) === true,
      ),
    wikipedia: cached(browser.storage.local, (term) => lookupWikipedia(term, (url, init) => fetch(url, init))),
    allow: () => void browser.runtime.sendMessage(OPEN_OPTIONS_MESSAGE),
  });

  const defined = table.keys.filter((k) => table.occurrences(k).some((o) => o.definition)).length;
  console.info(
    `[PaperPeek] ${table.keys.length} symbols (${defined} defined), ${terms.hits.length} terms, ready in ${(performance.now() - start).toFixed(0)} ms`,
  );
  // Side panel: list this page's symbols, and jump to one on request.
  const onMessage = (message: unknown): Promise<unknown> | undefined => {
    const m = message as { type?: string; order?: number };
    if (m.type === SYMBOLS_MESSAGE) return Promise.resolve({ title: doc.title, rows: symbolRows(doc, table) });
    if (m.type === JUMP_MESSAGE && typeof m.order === 'number') {
      const target = occurrenceByOrder.get(m.order);
      if (target) popup.jumpTo(target.formula ?? target.el);
      return Promise.resolve(Boolean(target));
    }
    return undefined;
  };
  const occurrenceByOrder = new Map(table.keys.flatMap((k) => table.occurrences(k)).map((o) => [o.order, o]));
  browser.runtime.onMessage.addListener(onMessage);

  return () => {
    browser.runtime.onMessage.removeListener(onMessage);
    detachHover();
    detachLookup();
    unpaint();
    popup.host.remove();
  };
}
