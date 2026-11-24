import { enabledPatterns } from '../core/sites';

const SCRIPT_ID = 'paperpeek-sites';

/** Keep one registered content script whose matches are exactly the origins the reader granted. */
async function sync(): Promise<void> {
  const matches = enabledPatterns((await browser.permissions.getAll()).origins);
  const registered = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (registered.length) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (!matches.length) return;
  await browser.scripting.registerContentScripts([{ id: SCRIPT_ID, matches, js: ['/content-scripts/site.js'], runAt: 'document_idle' }]);
}

// Events can overlap (install + permission grant); run syncs one after another
// so two never race to register the same id.
let queue = Promise.resolve();
const resync = (): void => {
  queue = queue.then(sync).catch((error: unknown) => console.error('[PaperPeek] sync failed', error));
};

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(resync);
  browser.runtime.onStartup.addListener(resync);
  browser.permissions.onAdded.addListener(resync);
  browser.permissions.onRemoved.addListener(resync);
});
