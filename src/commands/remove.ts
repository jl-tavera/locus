import { removeSite } from '../core/store.js';
import { normalizeUrl } from '../utils/url.js';

export async function runRemove(rawUrl: string): Promise<void> {
  const url = normalizeUrl(rawUrl);
  const { removed } = removeSite(url);
  if (removed) {
    console.log(`removed: ${url}`);
  } else {
    console.log(`not found: ${url}`);
  }
}
