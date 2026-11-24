import { arxivIdFrom } from '../core/resolver';
import { showResolverChip } from '../ui/resolver-chip';

// arXiv abstract pages: offer the HTML version, where PaperPeek can read the paper.
export default defineContentScript({
  matches: ['https://arxiv.org/abs/*'],
  runAt: 'document_idle',
  main(ctx) {
    const id = arxivIdFrom(location.href);
    if (id) ctx.onInvalidated(showResolverChip(document, id));
  },
});
