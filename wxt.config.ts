import { defineConfig } from 'wxt';

export default defineConfig({
  // WXT defaults Firefox to MV2; use MV3 everywhere so both builds share one manifest shape.
  manifestVersion: 3,
  manifest: {
    name: 'MathLens',
    description:
      'Hover any math symbol or ML term in a paper to see its definition, diagrams, figures and demos.',
    browser_specific_settings: {
      gecko: {
        id: 'mathlens@blakc-coffee.github.io',
        data_collection_permissions: { required: ['none'] },
      },
    },
  },
});
