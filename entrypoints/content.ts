import { extractOccurrences } from '../adapters/arxiv-html';
import { compileMatcher } from '../core/glossary';
import { SymbolTable } from '../core/symbol-table';
import glossary from '../data/glossary/core.json';
import { attachHover } from '../ui/hover';
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
    const terms = new TermIndex(document, document.querySelectorAll('.ltx_p, .ltx_caption'), compileMatcher(glossary.entries));
    const unpaint = paintTerms(document, terms);
    const detach = attachHover(document, { table, terms }, new Popup(document));
    ctx.onInvalidated(() => {
      detach();
      unpaint();
    });

    const defined = table.keys.filter((k) => table.occurrences(k).some((o) => o.definition)).length;
    console.info(
      `[PaperPeek] ${table.keys.length} symbols (${defined} defined), ${terms.hits.length} terms, ready in ${(performance.now() - start).toFixed(0)} ms`,
    );
  },
});
