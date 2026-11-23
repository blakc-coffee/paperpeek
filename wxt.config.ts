import { defineConfig } from 'wxt';

export default defineConfig({
  // WXT defaults Firefox to MV2; use MV3 everywhere so both builds share one manifest shape.
  manifestVersion: 3,
  manifest: {
    name: 'PaperPeek',
    // storage: the Wikipedia setting and its 7-day lookup cache. No host permissions:
    // Wikipedia is reached with plain CORS fetches, only when the reader allows it.
    permissions: ['storage'],
    description:
      'Hover any symbol, AI/ML term or figure in a paper to see its definition, diagrams, figures and demos.',
    browser_specific_settings: {
      gecko: {
        id: 'paperpeek@blakc-coffee.github.io',
        data_collection_permissions: { required: ['none'] },
      },
    },
  },
});
