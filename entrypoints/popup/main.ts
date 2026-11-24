import { originPattern } from '../../core/sites';

const site = document.getElementById('site')!;
const status = document.getElementById('status')!;
const toggle = document.getElementById('toggle') as HTMLButtonElement;

document.getElementById('options')!.addEventListener('click', (e) => {
  e.preventDefault();
  void browser.runtime.openOptionsPage();
});

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const pattern = originPattern(tab?.url);
const host = pattern ? new URL(tab!.url!).hostname : '';
site.textContent = host;

if (!pattern || tab?.id === undefined) {
  status.textContent = 'PaperPeek can’t run on this page.';
} else if (/^(arxiv\.org|ar5iv\.labs\.arxiv\.org)$/.test(host)) {
  status.textContent = 'Always on for arXiv HTML papers.';
} else {
  const tabId = tab.id;
  const render = (enabled: boolean): void => {
    status.textContent = enabled
      ? 'On for this site: terms, demos, lookups, and symbols in native MathML.'
      : 'Off for this site. Enabling asks your browser for access to this site only.';
    toggle.textContent = enabled ? 'Turn off for this site' : 'Enable on this site';
    toggle.className = enabled ? 'secondary' : '';
    toggle.hidden = false;
  };
  let enabled = await browser.permissions.contains({ origins: [pattern] });
  render(enabled);

  toggle.addEventListener('click', async () => {
    if (enabled) {
      enabled = !(await browser.permissions.remove({ origins: [pattern] }));
      // The background script unregisters the content script; reload to clear this tab.
      if (!enabled) await browser.tabs.reload(tabId);
    } else {
      // Must be the first await so the browser still sees the click as a user gesture.
      enabled = await browser.permissions.request({ origins: [pattern] });
      // The background script registers it for future visits; run it in this tab now.
      if (enabled) await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/site.js'] });
    }
    render(enabled);
  });
}
