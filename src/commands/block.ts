import { getProfileHostnames } from '../core/profiles.js';
import { writeBlock } from '../core/hosts.js';
import { flushDns } from '../core/dns.js';
import { cycleBrowsers } from '../core/browsers.js';
import { requireElevated } from '../core/privileges.js';

export async function runBlock(profileName: string): Promise<void> {
  const hostnames = getProfileHostnames(profileName);
  if (hostnames.length === 0) {
    throw new Error(`profile "${profileName}" has no sites to block`);
  }
  await requireElevated();
  const { backupPath } = await writeBlock(hostnames);
  await flushDns();
  await cycleBrowsers();
  console.log(`blocked ${hostnames.length} site${hostnames.length === 1 ? '' : 's'} from "${profileName}"`);
  console.log(`backup: ${backupPath}`);
}
