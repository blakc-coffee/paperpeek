import { serialSync, type RegistrationApi } from '../core/site-sync';

export default defineBackground(() => {
  const resync = serialSync(browser as unknown as RegistrationApi, (error) => console.error('[PaperPeek] sync failed', error));
  const run = (): void => void resync();
  browser.runtime.onInstalled.addListener(run);
  browser.runtime.onStartup.addListener(run);
  browser.permissions.onAdded.addListener(run);
  browser.permissions.onRemoved.addListener(run);
});
