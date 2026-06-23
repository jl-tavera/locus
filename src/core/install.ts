import os from 'node:os';
import { execa } from 'execa';
import { getPlatform } from './platform.js';
import { isElevated } from './privileges.js';

export type InstallReason =
  | 'declined'
  | 'failed'
  | 'not-windows'
  | 'already-writable';

export interface InstallResult {
  ok: boolean;
  reason?: InstallReason;
  detail?: string;
}

const HOSTS_WIN_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

function getWindowsUser(): string {
  const user = (process.env.USERNAME ?? os.userInfo().username).trim();
  if (!user) throw new Error('could not resolve windows username');
  return user;
}

export async function grantHostsWriteAccess(): Promise<InstallResult> {
  if (getPlatform() !== 'win32') {
    return { ok: false, reason: 'not-windows' };
  }
  if (await isElevated()) {
    return { ok: true, reason: 'already-writable' };
  }

  let user: string;
  try {
    user = getWindowsUser();
  } catch (err) {
    return {
      ok: false,
      reason: 'failed',
      detail: `could not resolve windows username: ${(err as Error).message}`,
    };
  }

  // Build the inner icacls invocation as a single string. icacls accepts the
  // file path and grant spec quoted; PowerShell's Start-Process splits the
  // ArgumentList on commas, so we pass each token as its own element.
  const inner = `icacls '${HOSTS_WIN_PATH}' /grant '${user}:M'`;
  const psScript = [
    'try {',
    `  $p = Start-Process -Wait -PassThru -Verb RunAs powershell -ArgumentList '-NoProfile','-Command',"${inner}";`,
    '  exit $p.ExitCode',
    '} catch {',
    // ERROR_CANCELLED = 1223 — surfaces as a System.ComponentModel.Win32Exception
    '  if ($_.Exception.NativeErrorCode -eq 1223) { exit 1223 }',
    '  Write-Error $_.Exception.Message',
    '  exit 1',
    '}',
  ].join('\n');

  try {
    await execa('powershell.exe', ['-NoProfile', '-Command', psScript]);
  } catch (err) {
    const e = err as { exitCode?: number; stderr?: string; message?: string };
    if (e.exitCode === 1223) {
      return { ok: false, reason: 'declined' };
    }
    return {
      ok: false,
      reason: 'failed',
      detail: e.stderr?.trim() || e.message || 'unknown failure',
    };
  }

  if (await isElevated()) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: 'failed',
    detail: 'icacls reported success but the hosts file is still not writable',
  };
}
