import {
  type Profile,
  type Site,
  addSite,
  createProfile as createProfileRaw,
  deleteProfile as deleteProfileRaw,
  findProfileByName,
  findSiteByUrl,
  getActiveFocus,
  listProfilesRaw,
  listSites,
  setProfileSites,
} from './store.js';
import { normalizeUrl } from '../utils/url.js';

export interface ProfileWithSites {
  id: string;
  name: string;
  sites: Site[];
}

function requireProfile(name: string): Profile {
  const profile = findProfileByName(name);
  if (!profile) throw new Error(`profile "${name}" not found`);
  return profile;
}

export function createProfile(name: string): Profile {
  return createProfileRaw(name);
}

export function deleteProfile(name: string): void {
  const profile = findProfileByName(name);
  if (!profile) throw new Error(`profile "${name}" not found`);
  const focus = getActiveFocus();
  if (focus && focus.profileId === profile.id) {
    throw new Error(`cannot delete "${name}" while a focus session is using it`);
  }
  deleteProfileRaw(name);
}

export function listProfiles(): ProfileWithSites[] {
  const sites = listSites();
  const byId = new Map(sites.map((s) => [s.id, s]));
  return listProfilesRaw().map((p) => ({
    id: p.id,
    name: p.name,
    sites: p.siteIds
      .map((id) => byId.get(id))
      .filter((s): s is Site => Boolean(s)),
  }));
}

export function getProfile(name: string): ProfileWithSites {
  const profile = requireProfile(name);
  const sites = listSites();
  const byId = new Map(sites.map((s) => [s.id, s]));
  return {
    id: profile.id,
    name: profile.name,
    sites: profile.siteIds
      .map((id) => byId.get(id))
      .filter((s): s is Site => Boolean(s)),
  };
}

export function addSiteToProfile(
  profileName: string,
  url: string,
): { siteUrl: string; created: boolean; alreadyMember: boolean } {
  const normalized = normalizeUrl(url);
  const profile = requireProfile(profileName);
  const existing = findSiteByUrl(normalized);
  let created = false;
  let siteId: string;
  if (existing) {
    siteId = existing.id;
  } else {
    const result = addSite(normalized);
    siteId = result.site.id;
    created = result.created;
  }
  const alreadyMember = profile.siteIds.includes(siteId);
  if (!alreadyMember) {
    setProfileSites(profile.id, [...profile.siteIds, siteId]);
  }
  return { siteUrl: normalized, created, alreadyMember };
}

export function removeSiteFromProfile(
  profileName: string,
  url: string,
): { removed: boolean; siteUrl: string } {
  const normalized = normalizeUrl(url);
  const profile = requireProfile(profileName);
  const site = findSiteByUrl(normalized);
  if (!site) return { removed: false, siteUrl: normalized };
  if (!profile.siteIds.includes(site.id)) return { removed: false, siteUrl: normalized };
  setProfileSites(
    profile.id,
    profile.siteIds.filter((id) => id !== site.id),
  );
  return { removed: true, siteUrl: normalized };
}

export function getProfileHostnames(profileName: string): string[] {
  return getProfile(profileName).sites.map((s) => s.url);
}
