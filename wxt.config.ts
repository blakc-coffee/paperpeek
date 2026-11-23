import { defineConfig } from 'wxt';

export default defineConfig({
  // WXT defaults Firefox to MV2; use MV3 everywhere so both builds share one manifest shape.
  manifestVersion: 3,
  manifest: {
    name: 'PaperPeek',
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
