import { listSites, listProfilesRaw } from '../core/store.js';

export async function runList(): Promise<void> {
  const sites = listSites();
  if (sites.length === 0) {
    console.log('no sites yet. add one with: locus add <url>');
    return;
  }
  const profiles = listProfilesRaw();
  const profilesBySite = new Map<string, string[]>();
  for (const profile of profiles) {
    for (const id of profile.siteIds) {
      const list = profilesBySite.get(id) ?? [];
      list.push(profile.name);
      profilesBySite.set(id, list);
    }
  }

  const urlWidth = Math.max(3, ...sites.map((s) => s.url.length));
  console.log(`${pad('url', urlWidth)}  profiles`);
  console.log(`${'-'.repeat(urlWidth)}  --------`);
  for (const site of sites) {
    const profileNames = profilesBySite.get(site.id) ?? [];
    const profilesText = profileNames.length === 0 ? '—' : profileNames.join(', ');
    console.log(`${pad(site.url, urlWidth)}  ${profilesText}`);
  }
}

function pad(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - value.length));
}
