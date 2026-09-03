import { existsSync } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { getPlatform } from './platform.js';

// One-shot task that re-applies the block the moment an unlock window ends.
const RELOCK_TASK = 'locus-relock';
// Permanent watchdog. The one-shot above is fire-once: if it is killed, missed,
// or unregistered, nothing else re-locks until you next open locus — which is
// how a 15-minute unlock once stayed open for a week. This task runs `locus
// guard` at logon and every few minutes forever, so a lost re-lock self-heals.
const GUARD_TASK = 'locus-guard';
const GUARD_INTERVAL_MIN = 5;
// How long the guard may go without a tick before `locus status` calls it out.
// Three intervals: one missed tick is normal (the machine slept, a tick
// overlapped), three in a row means it is not running.
const GUARD_STALE_AFTER_MS = GUARD_INTERVAL_MIN * 3 * 60_000;

function schedulingEnabled(): boolean {
  // Dev sandbox edits a temp hosts file and must not touch the real Task
  // Scheduler. Only native Windows has the background-relock mechanism.
  if (process.env.LOCUS_HOSTS_PATH) return false;
  return getPlatform() === 'win32';
}

// The command a task runs: `"<node>" "<dist/cli.js>" <sub>`. argv[1] is the
// bundled entry point that's currently executing.
function locusCommand(): { node: string; entry: string } {
  return { node: process.execPath, entry: process.argv[1] ?? '' };
}

/** Single-quote a string for PowerShell, escaping embedded quotes. */
function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

async function runPowerShell(script: string): Promise<string> {
  const { stdout } = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  return stdout;
}

/**
 * PowerShell that builds the `$action` running `locus <sub>`, hosted so it draws
 * no window.
 *
 * Both tasks run under an Interactive principal, and node.exe is a
 * console-subsystem binary — so Task Scheduler gives every tick a real console in
 * the user's session. That is a terminal flashing open every GUARD_INTERVAL_MIN
 * minutes, forever. `-Hidden` is not the fix: it only hides the task from the
 * Task Scheduler list.
 *
 * The documented fix is an S4U principal (session 0, no window), but registering
 * one requires elevation — and `ensureGuardTask()` re-registers unelevated on
 * every TUI launch, which would immediately downgrade it back to Interactive.
 * conhost's `--headless` instead hosts the child on a pseudoconsole with no
 * window at all, needs no privileges, and lives in the action itself, so
 * re-registration carries it along.
 *
 * Verified on Windows 11 by enumerating visible top-level windows mid-tick: a
 * bare node action adds a PseudoConsoleWindow plus a terminal host window;
 * through conhost, nothing is created.
 *
 * `--headless` is undocumented, hence the two hedges: fall back to launching node
 * directly if conhost.exe is missing, and note that conhost swallows the child's
 * exit code (the task always reports 0x0). Nothing reads LastTaskResult —
 * `checkGuardHealth()` watches LastRunTime, which stays accurate and is what
 * would catch this arrangement breaking on some future Windows build.
 */
function actionPs(node: string, entry: string, sub: string): string {
  const conhost = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'conhost.exe');
  if (!existsSync(conhost)) {
    return `$action = New-ScheduledTaskAction -Execute ${q(node)} -Argument ('"' + ${q(entry)} + '" ${sub}')`;
  }
  return `$action = New-ScheduledTaskAction -Execute ${q(conhost)} -Argument ('--headless "' + ${q(node)} + '" "' + ${q(entry)} + '" ${sub}')`;
}

/**
 * Register (or overwrite) a one-shot task that re-locks at `endsAt`. Runs as the
 * current user — no admin needed, and that user already holds the hosts-file
 * Modify grant from `locus setup`. Best-effort: failures are logged but never
 * throw, because the guard task, the foreground countdown and startup recover()
 * are all backstops.
 *
 * Hardening, each earning its place from an observed failure:
 * - `-WakeToRun` — without it a machine asleep at `endsAt` simply misses the
 *   trigger and `-StartWhenAvailable` fires it hours later, on wake.
 * - `-RestartCount/-RestartInterval` — the late run was terminated
 *   (0xC000013A) as the machine resumed and slept again; a `-Once` trigger that
 *   has already fired is never retried on its own.
 * - the `-AtLogOn` trigger — catches a window that lapsed while logged off.
 * - it runs `guard`, not `relock`: `relock()` ends *any* unlock, including a
 *   live one, so an at-logon fire would silently cut a real unlock short.
 */
export async function scheduleRelock(endsAt: Date): Promise<void> {
  if (!schedulingEnabled()) return;
  const { node, entry } = locusCommand();
  if (!entry) return;

  // ISO with no offset is parsed by PowerShell's [datetime] in local time.
  const at = endsAt.toISOString();
  // Build the task in PowerShell to avoid schtasks' locale-sensitive date format
  // and get second precision.
  const ps = [
    actionPs(node, entry, 'guard'),
    `$t1 = New-ScheduledTaskTrigger -Once -At ([datetime]${q(at)})`,
    `$t2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME`,
    `$settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Minutes 5)`,
    `Register-ScheduledTask -TaskName ${q(RELOCK_TASK)} -Action $action -Trigger $t1,$t2 -Settings $settings -Force | Out-Null`,
  ].join('; ');

  try {
    await runPowerShell(ps);
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    console.error(`locus: could not schedule auto re-lock: ${e.stderr?.trim() || e.message}`);
  }
}

/** Remove the one-shot re-lock task if present. Ignores "not found". Never throws. */
export async function cancelRelock(): Promise<void> {
  if (!schedulingEnabled()) return;
  try {
    await runPowerShell(
      `Unregister-ScheduledTask -TaskName ${q(RELOCK_TASK)} -Confirm:$false -ErrorAction SilentlyContinue`,
    );
  } catch {
    // task absent or scheduler unavailable — nothing to clean up
  }
}

/**
 * Install the permanent guard task: `locus guard` at logon and every
 * GUARD_INTERVAL_MIN minutes, indefinitely. Idempotent (`-Force` overwrites), so
 * it is safe to call from `locus setup` and on every first-run TUI launch.
 *
 * A tick is cheap: `applyLock()` reads the hosts block and returns early when it
 * already matches, so the steady state is one short-lived node process every few
 * minutes that writes nothing.
 */
export async function registerGuardTask(): Promise<{ ok: boolean; detail?: string }> {
  if (!schedulingEnabled()) return { ok: false, detail: 'scheduling disabled' };
  const { node, entry } = locusCommand();
  if (!entry) return { ok: false, detail: 'could not resolve the locus entry point' };

  const ps = [
    actionPs(node, entry, 'guard'),
    `$t1 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME`,
    // -Once at "now" plus an indefinite repetition is the documented way to get a
    // forever-repeating trigger; New-ScheduledTaskTrigger has no -Daily+interval
    // equivalent with sub-hour precision.
    `$t2 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes ${GUARD_INTERVAL_MIN})`,
    `$settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)`,
    `Register-ScheduledTask -TaskName ${q(GUARD_TASK)} -Action $action -Trigger $t1,$t2 -Settings $settings -Force | Out-Null`,
  ].join('; ');

  try {
    await runPowerShell(ps);
    return { ok: true };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return { ok: false, detail: e.stderr?.trim() || e.message || 'unknown error' };
  }
}

/** Remove the guard task. Never throws. */
export async function unregisterGuardTask(): Promise<void> {
  if (!schedulingEnabled()) return;
  try {
    await runPowerShell(
      `Unregister-ScheduledTask -TaskName ${q(GUARD_TASK)} -Confirm:$false -ErrorAction SilentlyContinue`,
    );
  } catch {
    // absent or scheduler unavailable
  }
}

export type GuardHealth =
  | { state: 'ok' }
  | { state: 'missing' }
  | { state: 'stale'; lastRun: Date | null };

/**
 * Whether the guard is installed *and* actually ticking. Never throws.
 *
 * Registration alone is not evidence it works: the task can sit there `Ready`
 * while every run fails to launch, and conhost hides the child's exit code so
 * LastTaskResult stays a reassuring 0x0. LastRunTime is set by the scheduler
 * itself, so it stays honest — a guard that has not run in GUARD_STALE_AFTER_MS
 * is not backstopping anything, and `locus status` is the only place the user
 * would ever find out.
 */
export async function checkGuardHealth(): Promise<GuardHealth> {
  if (!schedulingEnabled()) return { state: 'ok' };
  let out: string;
  try {
    out = await runPowerShell(
      [
        `$i = Get-ScheduledTaskInfo -TaskName ${q(GUARD_TASK)} -ErrorAction SilentlyContinue`,
        `if (-not $i) { 'missing' }`,
        // A task registered but never run reports a null/sentinel LastRunTime.
        `elseif (-not $i.LastRunTime -or $i.LastRunTime.Year -lt 2000) { 'never' }`,
        `else { $i.LastRunTime.ToUniversalTime().ToString('o') }`,
      ].join('; '),
    );
  } catch {
    // scheduler unavailable — no basis to claim the guard is broken
    return { state: 'ok' };
  }

  const value = out.trim();
  if (value === 'missing') return { state: 'missing' };
  if (value === 'never') return { state: 'stale', lastRun: null };

  const lastRun = new Date(value);
  if (Number.isNaN(lastRun.getTime())) return { state: 'ok' };
  if (Date.now() - lastRun.getTime() > GUARD_STALE_AFTER_MS) return { state: 'stale', lastRun };
  return { state: 'ok' };
}
