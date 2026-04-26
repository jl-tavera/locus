import {
  addSiteToProfile,
  createProfile,
  deleteProfile,
  listProfiles,
  removeSiteFromProfile,
} from '../core/profiles.js';

export async function runProfileCreate(name: string): Promise<void> {
  const profile = createProfile(name);
  console.log(`created profile: ${profile.name}`);
}

export async function runProfileDelete(name: string): Promise<void> {
  deleteProfile(name);
  console.log(`deleted profile: ${name}`);
}

export async function runProfileList(): Promise<void> {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.log('no profiles yet. create one with: locus profile create <name>');
    return;
  }
  const nameWidth = Math.max(4, ...profiles.map((p) => p.name.length));
  console.log(`${pad('name', nameWidth)}  sites`);
  console.log(`${'-'.repeat(nameWidth)}  -----`);
  for (const profile of profiles) {
    console.log(`${pad(profile.name, nameWidth)}  ${profile.sites.length}`);
  }
}

export async function runProfileAdd(profileName: string, url: string): Promise<void> {
  const result = addSiteToProfile(profileName, url);
  if (result.alreadyMember) {
    console.log(`${result.siteUrl} is already in ${profileName}`);
    return;
  }
  if (result.created) {
    console.log(`added ${result.siteUrl} to library and to profile ${profileName}`);
  } else {
    console.log(`added ${result.siteUrl} to profile ${profileName}`);
  }
}

export async function runProfileRemove(profileName: string, url: string): Promise<void> {
  const result = removeSiteFromProfile(profileName, url);
  if (result.removed) {
    console.log(`removed ${result.siteUrl} from profile ${profileName}`);
  } else {
    console.log(`${result.siteUrl} is not in profile ${profileName}`);
  }
}

function pad(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - value.length));
}
