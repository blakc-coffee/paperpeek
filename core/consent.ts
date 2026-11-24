// Firefox's built-in data-collection consent. A Wikipedia lookup sends the
// selected term to a third party, so the Firefox build declares it as the
// optional `searchTerms` type and needs the reader's grant before the first
// lookup. Chrome has no such consent; callers check `import.meta.env.FIREFOX`.
//
// Content scripts can't use the permissions API, and `permissions.request`
// only works inside a user action on an extension page, so the content
// script asks the background whether consent exists and the options page
// requests it.

import type { WikiMode } from '../ui/lookup';

/** `permissions.Permissions` with Firefox's `data_collection` member. */
export const SEARCH_TERMS = { data_collection: ['searchTerms'] };
export const CONSENT_MESSAGE = 'paperpeek:search-terms-consent';
export const OPEN_OPTIONS_MESSAGE = 'paperpeek:open-options';

/**
 * The lookup mode that actually applies: the stored setting, or 'consent'
 * when Firefox would send a term the reader hasn't agreed to share yet.
 */
export async function effectiveMode(
  stored: WikiMode,
  firefox: boolean,
  granted: () => Promise<boolean>,
): Promise<WikiMode | 'consent'> {
  if (stored === 'never' || !firefox) return stored;
  return (await granted()) ? stored : 'consent';
}
