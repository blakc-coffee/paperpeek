import { GENERIC, WIKIPEDIA } from '../adapters/arxiv-html';
import { arxivIdFrom } from '../core/resolver';
import { showResolverChip } from '../ui/resolver-chip';
import { startPaperPeek } from '../ui/start';

// Runs only on sites the reader enabled from the toolbar button. The background
// script registers it for exactly the origins the reader granted.
export default defineContentScript({
  registration: 'runtime',
  matches: [],
  runAt: 'document_idle',
  main(ctx) {
    // Enabling a site also injects into the open tab, so guard against running twice.
    const root = document.documentElement;
    if (root.dataset.paperpeek) return;
    root.dataset.paperpeek = 'on';

    const id = arxivIdFrom(location.href);
    if (id) {
      ctx.onInvalidated(showResolverChip(document, id));
      return;
    }
    const profile = /(^|\.)wikipedia\.org$/.test(location.hostname) ? WIKIPEDIA : GENERIC;
    const stop = startPaperPeek(document, profile);
    ctx.onInvalidated(() => {
      stop();
      delete root.dataset.paperpeek;
    });
  },
});
