import { CONSENT_MESSAGE, OPEN_OPTIONS_MESSAGE, SEARCH_TERMS } from '../core/consent';
import { serialSync, type RegistrationApi } from '../core/site-sync';

export default defineBackground(() => {
  const resync = serialSync(browser as unknown as RegistrationApi, (error) => console.error('[PaperPeek] sync failed', error));
  const run = (): void => void resync();
  browser.runtime.onInstalled.addListener(run);
  browser.runtime.onStartup.addListener(run);
  browser.permissions.onAdded.addListener(run);
  browser.permissions.onRemoved.addListener(run);

  // Firefox data-collection consent: content scripts can't read permissions or
  // request them, so they ask here (see core/consent.ts).
  if (import.meta.env.FIREFOX) {
    browser.runtime.onMessage.addListener((message: unknown) => {
      if (message === CONSENT_MESSAGE) return browser.permissions.contains(SEARCH_TERMS as Browser.permissions.Permissions);
      if (message === OPEN_OPTIONS_MESSAGE) return browser.runtime.openOptionsPage();
      return undefined;
    });
  }
});
