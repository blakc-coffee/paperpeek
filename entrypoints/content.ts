import { LATEXML } from '../adapters/arxiv-html';
import { startPaperPeek } from '../ui/start';

// arXiv HTML and ar5iv (LaTeXML) are always on: symbols, figures, terms, demos.
export default defineContentScript({
  matches: ['https://arxiv.org/html/*', 'https://ar5iv.labs.arxiv.org/html/*'],
  runAt: 'document_idle',
  main(ctx) {
    ctx.onInvalidated(startPaperPeek(document, LATEXML));
  },
});
