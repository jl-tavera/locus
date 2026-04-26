import { addSite } from '../core/store.js';
import { normalizeUrl } from '../utils/url.js';

export async function runAdd(rawUrl: string): Promise<void> {
  const url = normalizeUrl(rawUrl);
  const { created } = addSite(url);
  if (created) {
    console.log(`added: ${url}`);
  } else {
    console.log(`already in library: ${url}`);
  }
}
