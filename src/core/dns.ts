import { execa } from 'execa';
import { getPlatform } from './platform.js';

export async function flushDns(): Promise<void> {
  try {
    switch (getPlatform()) {
      case 'darwin':
        await execa('dscacheutil', ['-flushcache']);
        await execa('killall', ['-HUP', 'mDNSResponder']);
        break;
      case 'win32':
        await execa('ipconfig', ['/flushdns']);
        break;
      case 'wsl':
        await execa('ipconfig.exe', ['/flushdns']);
        break;
      case 'linux':
      default:
        await execa('resolvectl', ['flush-caches']);
        break;
    }
  } catch {
    // DNS flush is best-effort; never fail the parent operation
  }
}
