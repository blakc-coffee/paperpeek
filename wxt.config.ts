import { defineConfig } from 'wxt';

export default defineConfig({
  // WXT defaults Firefox to MV2; use MV3 everywhere so both builds share one manifest shape.
  manifestVersion: 3,
  manifest: {
    name: 'PaperPeek',
    homepage_url: 'https://blakc-coffee.github.io/paperpeek/',
    // storage: the Wikipedia setting and its 7-day lookup cache (Wikipedia is reached
    // with plain CORS fetches, only when the reader allows it).
    // scripting + activeTab + optional hosts: the reader enables other sites one at a
    // time from the toolbar button; nothing runs outside arXiv until they do.
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    action: { default_title: 'PaperPeek' },
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
