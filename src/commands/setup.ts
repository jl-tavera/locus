import { grantHostsWriteAccess } from '../core/install.js';

export async function runSetup(): Promise<void> {
  const result = await grantHostsWriteAccess();

  if (result.ok && result.reason === 'already-writable') {
    console.log('already set up — nothing to do.');
    return;
  }
  if (result.ok) {
    console.log('setup complete. you can now run locus from any terminal.');
    return;
  }

  switch (result.reason) {
    case 'not-wsl':
      console.log('setup is only needed on WSL — nothing to do.');
      return;
    case 'declined':
      console.error('cancelled. (UAC prompt was declined.)');
      process.exit(1);
    case 'failed':
    default:
      console.error(`setup failed: ${result.detail ?? 'unknown error'}`);
      process.exit(1);
  }
}
