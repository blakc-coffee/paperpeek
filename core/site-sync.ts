// Keeps one runtime-registered content script whose matches are exactly the
// origins the reader granted. Takes the browser APIs as a parameter so the
// logic is testable without an extension runtime.

import { enabledPatterns } from './sites';

export const SITE_SCRIPT_ID = 'paperpeek-sites';
export const SITE_SCRIPT = '/content-scripts/site.js';

export interface RegistrationApi {
  permissions: { getAll(): Promise<{ origins?: string[] }> };
  scripting: {
    getRegisteredContentScripts(filter: { ids: string[] }): Promise<unknown[]>;
    unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
    registerContentScripts(
      scripts: Array<{ id: string; matches: string[]; js: string[]; runAt: 'document_idle' }>,
    ): Promise<void>;
  };
}

/** Re-register from scratch: simpler than diffing, and permission changes are rare. */
export async function syncSiteScript(api: RegistrationApi): Promise<string[]> {
  const matches = enabledPatterns((await api.permissions.getAll()).origins);
  const registered = await api.scripting.getRegisteredContentScripts({ ids: [SITE_SCRIPT_ID] });
  if (registered.length) await api.scripting.unregisterContentScripts({ ids: [SITE_SCRIPT_ID] });
  if (matches.length) {
    await api.scripting.registerContentScripts([{ id: SITE_SCRIPT_ID, matches, js: [SITE_SCRIPT], runAt: 'document_idle' }]);
  }
  return matches;
}

/**
 * Serialises syncs: install, startup and permission events can arrive together,
 * and two overlapping syncs would race to register the same id.
 */
export function serialSync(api: RegistrationApi, onError: (error: unknown) => void): () => Promise<void> {
  let queue = Promise.resolve();
  return () => {
    queue = queue.then(() => syncSiteScript(api)).then(() => undefined, onError);
    return queue;
  };
}
