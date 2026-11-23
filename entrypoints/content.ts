import { extractOccurrences } from '../adapters/arxiv-html';
import { SymbolTable } from '../core/symbol-table';
import { attachHover } from '../ui/hover';
import { Popup } from '../ui/popup';

// Phase 1: arXiv HTML (LaTeXML). Builds the symbol table once the page is idle,
// then shows a definition popup when a symbol is hovered.
export default defineContentScript({
  matches: ['https://arxiv.org/html/*', 'https://ar5iv.labs.arxiv.org/html/*'],
  runAt: 'document_idle',
  main(ctx) {
    const start = performance.now();
    const table = new SymbolTable(extractOccurrences(document));
    const detach = attachHover(document, table, new Popup(document));
    ctx.onInvalidated(detach);

    const defined = table.keys.filter((k) => table.occurrences(k).some((o) => o.definition)).length;
    console.info(
      `[PaperPeek] ${table.keys.length} symbols, ${defined} with definitions, ready in ${(performance.now() - start).toFixed(0)} ms`,
    );
  },
});
