import { enabledPatterns } from '../../core/sites';

const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="wikipedia"]'));
const status = document.getElementById('status')!;
const list = document.getElementById('sites')!;
const empty = document.getElementById('no-sites')!;

const { wikipedia = 'ask' } = await browser.storage.local.get('wikipedia');
for (const radio of radios) {
  radio.checked = radio.value === wikipedia;
  radio.addEventListener('change', async () => {
    await browser.storage.local.set({ wikipedia: radio.value });
    status.textContent = 'Saved.';
  });
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
