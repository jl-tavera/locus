import { execa } from 'execa';

export async function flushDns(): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await execa('dscacheutil', ['-flushcache']);
      await execa('killall', ['-HUP', 'mDNSResponder']);
    } else if (process.platform === 'win32') {
      await execa('ipconfig', ['/flushdns']);
    } else {
      await execa('resolvectl', ['flush-caches']);
    }
  } catch {
    // DNS flush is best-effort; never fail the parent operation
  }
}
