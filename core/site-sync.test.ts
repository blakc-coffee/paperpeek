import { describe, expect, it, vi } from 'vitest';
import { SITE_SCRIPT, SITE_SCRIPT_ID, serialSync, syncSiteScript, type RegistrationApi } from './site-sync';

/** In-memory stand-in for chrome.permissions + chrome.scripting, enforcing unique script ids like the real API. */
function fakeApi(origins: string[]) {
  const scripts = new Map<string, { matches: string[]; js: string[] }>();
  const delay = () => new Promise((r) => setTimeout(r, 0));
  const api: RegistrationApi = {
    permissions: { getAll: async () => ({ origins: [...origins] }) },
    scripting: {
      getRegisteredContentScripts: async ({ ids }) => {
        await delay();
        return ids.filter((id) => scripts.has(id)).map((id) => ({ id }));
      },
      unregisterContentScripts: async ({ ids }) => {
        await delay();
        for (const id of ids) scripts.delete(id);
      },
      registerContentScripts: async (list) => {
        await delay();
        for (const s of list) {
          if (scripts.has(s.id)) throw new Error(`Duplicate script ID '${s.id}'`);
          scripts.set(s.id, { matches: s.matches, js: s.js });
        }
      },
    },
  };
  return { api, scripts, origins };
}

describe('syncSiteScript', () => {
  it('registers one script for exactly the granted sites, ignoring arXiv and wildcards', async () => {
    const { api, scripts } = fakeApi(['https://en.wikipedia.org/*', 'https://arxiv.org/*', 'https://*/*']);
    expect(await syncSiteScript(api)).toEqual(['https://en.wikipedia.org/*']);
    expect(scripts.get(SITE_SCRIPT_ID)).toEqual({ matches: ['https://en.wikipedia.org/*'], js: [SITE_SCRIPT] });
  });

  it('replaces the registration when sites change, and removes it when none are left', async () => {
    const { api, scripts, origins } = fakeApi(['https://en.wikipedia.org/*']);
    await syncSiteScript(api);
    origins.push('https://lilianweng.github.io/*');
    await syncSiteScript(api);
    expect(scripts.get(SITE_SCRIPT_ID)?.matches).toEqual(['https://en.wikipedia.org/*', 'https://lilianweng.github.io/*']);
    origins.length = 0;
    await syncSiteScript(api);
    expect(scripts.size).toBe(0);
  });
});

describe('serialSync', () => {
  it('runs overlapping syncs one after another, so ids never collide', async () => {
    const { api, scripts } = fakeApi(['https://en.wikipedia.org/*']);
    const onError = vi.fn();
    const resync = serialSync(api, onError);
    await Promise.all([resync(), resync(), resync()]);
    expect(onError).not.toHaveBeenCalled();
    expect(scripts.size).toBe(1);
  });

  it('shows why serialising matters: unsynchronised calls collide', async () => {
    const { api } = fakeApi(['https://en.wikipedia.org/*']);
    const results = await Promise.allSettled([syncSiteScript(api), syncSiteScript(api)]);
    expect(results.some((r) => r.status === 'rejected')).toBe(true);
  });

  it('keeps going after a failure', async () => {
    const { api, scripts } = fakeApi(['https://en.wikipedia.org/*']);
    const onError = vi.fn();
    const failing = { ...api, permissions: { getAll: vi.fn().mockRejectedValueOnce(new Error('boom')).mockImplementation(api.permissions.getAll) } };
    const resync = serialSync(failing, onError);
    await resync();
    await resync();
    expect(onError).toHaveBeenCalledOnce();
    expect(scripts.size).toBe(1);
  });
});
