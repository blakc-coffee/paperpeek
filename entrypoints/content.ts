import { extractOccurrences } from '../adapters/arxiv-html';
import { SymbolTable } from '../core/symbol-table';

// Phase 1: arXiv HTML (LaTeXML). Builds the symbol table once the page is idle.
// v0.1 reports it in the console; the hover popup that uses it lands in v0.2.
export default defineContentScript({
  matches: ['https://arxiv.org/html/*', 'https://ar5iv.labs.arxiv.org/html/*'],
  runAt: 'document_idle',
  main() {
    const start = performance.now();
    const table = new SymbolTable(extractOccurrences(document));
    const ms = performance.now() - start;

    const defined = table.keys.flatMap((symbol) => {
      const occ = table.occurrences(symbol).find((o) => o.definition);
      return occ?.definition
        ? [{ symbol, meaning: occ.definition.gloss, confidence: occ.definition.confidence, section: occ.sectionId }]
        : [];
    });
    console.info(
      `[PaperPeek] ${table.keys.length} symbols, ${defined.length} with definitions, built in ${ms.toFixed(0)} ms`,
    );
    console.table(defined);
  },
});
