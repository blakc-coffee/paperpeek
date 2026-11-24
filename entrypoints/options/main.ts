import { SEARCH_TERMS } from '../../core/consent';
import { enabledPatterns } from '../../core/sites';

const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="wikipedia"]'));
const status = document.getElementById('status')!;
const list = document.getElementById('sites')!;
const empty = document.getElementById('no-sites')!;

const consent = document.getElementById('consent')!;
const allow = document.getElementById('allow') as HTMLButtonElement;
const searchTerms = SEARCH_TERMS as Browser.permissions.Permissions;

/** Firefox only: show the grant button while lookups are on but searchTerms isn't granted. */
const refreshConsent = async (mode: string): Promise<void> => {
  consent.hidden = mode === 'never' || (await browser.permissions.contains(searchTerms));
};

/**
 * Must run synchronously inside the click/change handler: Firefox only shows
 * the consent prompt during a user action. Already granted → resolves true without a prompt.
 */
const requestConsent = (): Promise<boolean> => browser.permissions.request(searchTerms);

const { wikipedia = 'ask' } = await browser.storage.local.get('wikipedia');
for (const radio of radios) {
  radio.checked = radio.value === wikipedia;
  radio.addEventListener('change', async () => {
    const granted = import.meta.env.FIREFOX && radio.value !== 'never' ? requestConsent() : null;
    await browser.storage.local.set({ wikipedia: radio.value });
    status.textContent = granted && !(await granted) ? 'Saved. Firefox lookups stay off until you allow them.' : 'Saved.';
    if (import.meta.env.FIREFOX) await refreshConsent(radio.value);
  });
}
if (import.meta.env.FIREFOX) {
  allow.addEventListener('click', async () => {
    const granted = await requestConsent();
    status.textContent = granted ? 'Wikipedia lookups allowed.' : 'Not allowed. Lookups stay off.';
    await refreshConsent(radios.find((r) => r.checked)?.value ?? 'ask');
  });
  await refreshConsent(wikipedia as string);
}

/** "https://en.wikipedia.org/*" → "en.wikipedia.org" (plus the scheme when it isn't https). */
const label = (pattern: string): string => pattern.replace(/^https:\/\//, '').replace(/\/\*$/, '');

/** The granted permission is the single source of truth; the background script re-registers on removal. */
async function renderSites(): Promise<void> {
  const patterns = enabledPatterns((await browser.permissions.getAll()).origins);
  list.replaceChildren(
    ...patterns.map((pattern) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = label(pattern);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${label(pattern)}`);
      remove.addEventListener('click', async () => {
        if (await browser.permissions.remove({ origins: [pattern] })) status.textContent = `Removed ${label(pattern)}.`;
      });
      item.append(name, remove);
      return item;
    }),
  );
  empty.hidden = patterns.length > 0;
}

browser.permissions.onAdded.addListener(() => void renderSites());
browser.permissions.onRemoved.addListener(() => void renderSites());
await renderSites();
