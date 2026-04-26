import { clearBlock } from '../core/hosts.js';
import { flushDns } from '../core/dns.js';
import { requireElevated } from '../core/privileges.js';
import { clearActiveFocus, getActiveFocus } from '../core/store.js';

export async function runUnblock(): Promise<void> {
  await requireElevated();
  const result = await clearBlock();
  await flushDns();
  if (getActiveFocus()) clearActiveFocus();
  if (result) {
    console.log('unblocked');
    console.log(`backup: ${result.backupPath}`);
  } else {
    console.log('nothing to unblock');
  }
}
