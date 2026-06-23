import {
  type Profile,
  type Site,
  createProfile as createProfileRaw,
  deleteProfile as deleteProfileRaw,
  findProfileByName,
  findSiteByUrl,
  getActiveUnlock,
  getLockProfileId,
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
  if (getLockProfileId() === profile.id) {
    throw new Error(`cannot delete "${name}" — it's the locked profile. switch the lock first.`);
  }
  const unlock = getActiveUnlock();
  if (unlock && unlock.profileId === profile.id) {
    throw new Error(`cannot delete "${name}" while it's unlocked. re-lock first.`);
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
): { siteUrl: string; alreadyMember: boolean } {
  const normalized = normalizeUrl(url);
  const profile = requireProfile(profileName);
  const site = findSiteByUrl(normalized);
  if (!site) {
    throw new Error(
      `"${normalized}" is not in the library. add it first: locus add ${normalized}`,
    );
  }
  const alreadyMember = profile.siteIds.includes(site.id);
  if (!alreadyMember) {
    setProfileSites(profile.id, [...profile.siteIds, site.id]);
  }
  return { siteUrl: normalized, alreadyMember };
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

export function toggleSiteInProfile(
  profileName: string,
  siteId: string,
): { isMember: boolean } {
  const profile = requireProfile(profileName);
  const isMember = profile.siteIds.includes(siteId);
  const next = isMember
    ? profile.siteIds.filter((id) => id !== siteId)
    : [...profile.siteIds, siteId];
  setProfileSites(profile.id, next);
  return { isMember: !isMember };
}

export function getProfileHostnames(profileName: string): string[] {
  return getProfile(profileName).sites.map((s) => s.url);
}
