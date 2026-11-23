import { extractOccurrences } from '../adapters/arxiv-html';
import { compileMatcher } from '../core/glossary';
import { SymbolTable } from '../core/symbol-table';
import { cached, lookupWikipedia } from '../core/wiki';
import glossary from '../data/glossary/core.json';
import generated from '../data/glossary/generated.json';
import { attachHover } from '../ui/hover';
import { attachLookup, type WikiMode } from '../ui/lookup';
import { Popup } from '../ui/popup';
import { paintTerms, TermIndex } from '../ui/terms';

// Phase 1: arXiv HTML (LaTeXML). Builds the symbol table and term index once
// the page is idle, then shows a popup for hovered symbols, figure refs and terms.
export default defineContentScript({
  matches: ['https://arxiv.org/html/*', 'https://ar5iv.labs.arxiv.org/html/*'],
  runAt: 'document_idle',
  main(ctx) {
    const start = performance.now();
    const table = new SymbolTable(extractOccurrences(document));
    // Only the hand-written core terms are highlighted; the ~365 generated entries
    // (ADictML, Wikidata) answer when the reader selects a phrase.
    const terms = new TermIndex(document, document.querySelectorAll('.ltx_p, .ltx_caption'), compileMatcher(glossary.entries));
    const match = compileMatcher([...glossary.entries, ...generated.entries]);
    const unpaint = paintTerms(document, terms);
    const popup = new Popup(document);
    const detachHover = attachHover(document, { table, terms }, popup);
    const detachLookup = attachLookup(document, {
      match,
      popup,
      // Wikipedia is opt-in: 'ask' (default) asks before each lookup.
      mode: async () => ((await browser.storage.local.get('wikipedia')).wikipedia as WikiMode | undefined) ?? 'ask',
      wikipedia: cached(browser.storage.local, (term) => lookupWikipedia(term, (url, init) => fetch(url, init))),
    });
    ctx.onInvalidated(() => {
      detachHover();
      detachLookup();
      unpaint();
    });

    const defined = table.keys.filter((k) => table.occurrences(k).some((o) => o.definition)).length;
    console.info(
      `[PaperPeek] ${table.keys.length} symbols (${defined} defined), ${terms.hits.length} terms, ready in ${(performance.now() - start).toFixed(0)} ms`,
    );
  },
});
