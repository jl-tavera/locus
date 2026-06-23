import { execa } from 'execa';
import { getPlatform } from './platform.js';

// Name of the one-shot Windows Scheduled Task that re-applies the block when an
// unlock window ends — even if the locus app/terminal has been closed.
const TASK_NAME = 'locus-relock';

function schedulingEnabled(): boolean {
  // Dev sandbox edits a temp hosts file and must not touch the real Task
  // Scheduler. Only native Windows has the background-relock mechanism.
  if (process.env.LOCUS_HOSTS_PATH) return false;
  return getPlatform() === 'win32';
}

// The command the task runs: `"<node>" "<dist/cli.js>" relock`. argv[1] is the
// bundled entry point that's currently executing.
function relockCommand(): { node: string; entry: string } {
  return { node: process.execPath, entry: process.argv[1] ?? '' };
}

/**
 * Register (or overwrite) a one-shot task that runs `locus relock` at `endsAt`.
 * Runs as the current user — no admin needed, and that user already holds the
 * hosts-file Modify grant from `locus setup`. Best-effort: failures are logged
 * but never throw, because the foreground countdown and startup recover() are
 * backstops.
 */
export async function scheduleRelock(endsAt: Date): Promise<void> {
  if (!schedulingEnabled()) return;
  const { node, entry } = relockCommand();
  if (!entry) return;

  // ISO with no offset is parsed by PowerShell's [datetime] in local time.
  const at = endsAt.toISOString();
  // Build the task in PowerShell to avoid schtasks' locale-sensitive date format
  // and get second precision. Single-quote our paths for PS; escape embedded '.
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const ps = [
    `$action = New-ScheduledTaskAction -Execute ${q(node)} -Argument ('"' + ${q(entry)} + '" relock')`,
    `$trigger = New-ScheduledTaskTrigger -Once -At ([datetime]${q(at)})`,
    `$settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable`,
    `Register-ScheduledTask -TaskName ${q(TASK_NAME)} -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null`,
  ].join('; ');

  try {
    await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    console.error(`locus: could not schedule auto re-lock: ${e.stderr?.trim() || e.message}`);
  }
}

/** Remove the re-lock task if present. Ignores "not found". Never throws. */
export async function cancelRelock(): Promise<void> {
  if (!schedulingEnabled()) return;
  const ps = `Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue`;
  try {
    await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  } catch {
    // task absent or scheduler unavailable — nothing to clean up
  }
}
