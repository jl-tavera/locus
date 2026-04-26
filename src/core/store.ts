import Conf from 'conf';
import { randomUUID } from 'node:crypto';

export interface Site {
  id: string;
  url: string;
  addedAt: string;
}

export interface Profile {
  id: string;
  name: string;
  siteIds: string[];
}

export interface ActiveFocus {
  profileId: string | null;
  startedAt: string;
  durationMs: number;
  endsAt: string;
}

export interface StoreSchema {
  sites: Site[];
  profiles: Profile[];
  activeFocus: ActiveFocus | null;
}

const defaults: StoreSchema = {
  sites: [],
  profiles: [],
  activeFocus: null,
};

let cached: Conf<StoreSchema> | null = null;

export function getStore(): Conf<StoreSchema> {
  if (!cached) {
    cached = new Conf<StoreSchema>({
      projectName: 'locus',
      projectSuffix: '',
      defaults,
    });
  }
  return cached;
}

export function getStorePath(): string {
  return getStore().path;
}

export function listSites(): Site[] {
  return [...getStore().get('sites')];
}

export function findSiteByUrl(url: string): Site | undefined {
  return getStore().get('sites').find((s) => s.url === url);
}

export function addSite(url: string): { site: Site; created: boolean } {
  const store = getStore();
  const sites = [...store.get('sites')];
  const existing = sites.find((s) => s.url === url);
  if (existing) return { site: existing, created: false };
  const site: Site = { id: randomUUID(), url, addedAt: new Date().toISOString() };
  sites.push(site);
  store.set('sites', sites);
  return { site, created: true };
}

export function removeSite(url: string): { removed: boolean; siteId?: string } {
  const store = getStore();
  const sites = [...store.get('sites')];
  const idx = sites.findIndex((s) => s.url === url);
  if (idx === -1) return { removed: false };
  const removed = sites[idx]!;
  sites.splice(idx, 1);
  store.set('sites', sites);
  const profiles = store.get('profiles').map((p) => ({
    ...p,
    siteIds: p.siteIds.filter((id) => id !== removed.id),
  }));
  store.set('profiles', profiles);
  return { removed: true, siteId: removed.id };
}

export function listProfilesRaw(): Profile[] {
  return [...getStore().get('profiles')];
}

export function findProfileByName(name: string): Profile | undefined {
  const lower = name.toLowerCase();
  return getStore()
    .get('profiles')
    .find((p) => p.name.toLowerCase() === lower);
}

export function findProfileById(id: string): Profile | undefined {
  return getStore().get('profiles').find((p) => p.id === id);
}

export function createProfile(name: string): Profile {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('profile name is empty');
  if (findProfileByName(trimmed)) {
    throw new Error(`profile "${trimmed}" already exists`);
  }
  const profile: Profile = { id: randomUUID(), name: trimmed, siteIds: [] };
  const store = getStore();
  const profiles = [...store.get('profiles'), profile];
  store.set('profiles', profiles);
  return profile;
}

export function deleteProfile(name: string): { removed: boolean } {
  const store = getStore();
  const profiles = [...store.get('profiles')];
  const idx = profiles.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return { removed: false };
  profiles.splice(idx, 1);
  store.set('profiles', profiles);
  return { removed: true };
}

export function setProfileSites(profileId: string, siteIds: string[]): void {
  const store = getStore();
  const profiles = store.get('profiles').map((p) =>
    p.id === profileId ? { ...p, siteIds: [...new Set(siteIds)] } : p,
  );
  store.set('profiles', profiles);
}

export function getActiveFocus(): ActiveFocus | null {
  return getStore().get('activeFocus');
}

export function setActiveFocus(focus: ActiveFocus): void {
  getStore().set('activeFocus', focus);
}

export function clearActiveFocus(): void {
  getStore().set('activeFocus', null);
}
