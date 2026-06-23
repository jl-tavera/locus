import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getPlatform } from './platform.js';

export const SENTINEL_START = '# >>> LOCUS START';
export const SENTINEL_END = '# <<< LOCUS END';
const MANAGED_HEADER = '# managed by LOCUS — do not edit by hand';
const MAX_BACKUPS = 10;

export interface HostsOpts {
  path?: string;
  backupDir?: string;
}

export function getHostsPath(): string {
  if (process.env.LOCUS_HOSTS_PATH) return process.env.LOCUS_HOSTS_PATH;
  const platform = getPlatform();
  if (platform === 'win32') {
    return 'C:\\Windows\\System32\\drivers\\etc\\hosts';
  }
  return '/etc/hosts';
}

export function getDefaultBackupDir(): string {
  // Keep backups beside the config when it's pinned (tests, custom locations).
  const configDir = process.env.LOCUS_CONFIG_DIR;
  if (configDir) return path.join(configDir, 'backups');
  const platform = process.platform;
  const home = os.homedir();
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'locus', 'backups');
  }
  if (platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'locus', 'backups');
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(home, '.config');
  return path.join(xdg, 'locus', 'backups');
}

function resolvePaths(opts?: HostsOpts) {
  return {
    hostsPath: opts?.path ?? getHostsPath(),
    backupDir: opts?.backupDir ?? getDefaultBackupDir(),
  };
}

export async function readHosts(opts?: HostsOpts): Promise<string> {
  const { hostsPath } = resolvePaths(opts);
  return fs.readFile(hostsPath, 'utf8');
}

interface BlockBoundaries {
  startLine: number;
  endLine: number;
}

function findBlock(lines: string[]): BlockBoundaries | null {
  let startLine = -1;
  let endLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]?.trim();
    if (trimmed === SENTINEL_START && startLine === -1) startLine = i;
    else if (trimmed === SENTINEL_END && startLine !== -1) {
      endLine = i;
      break;
    }
  }
  if (startLine === -1 || endLine === -1) return null;
  return { startLine, endLine };
}

function buildBlock(hostnames: string[]): string[] {
  const lines: string[] = [SENTINEL_START, MANAGED_HEADER];
  for (const host of hostnames) {
    lines.push(`127.0.0.1 ${host}`);
    lines.push(`127.0.0.1 www.${host}`);
  }
  lines.push(SENTINEL_END);
  return lines;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function backupHosts(hostsPath: string, backupDir: string): Promise<string> {
  await ensureDir(backupDir);
  const stamp = new Date().toISOString().replace(/:/g, '-');
  const backupPath = path.join(backupDir, `hosts.${stamp}.bak`);
  const current = await fs.readFile(hostsPath);
  await fs.writeFile(backupPath, current);
  await pruneBackups(backupDir);
  return backupPath;
}

async function pruneBackups(backupDir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(backupDir);
  } catch {
    return;
  }
  const backups = entries.filter((f) => f.startsWith('hosts.') && f.endsWith('.bak'));
  if (backups.length <= MAX_BACKUPS) return;
  const stats = await Promise.all(
    backups.map(async (name) => {
      const full = path.join(backupDir, name);
      const stat = await fs.stat(full);
      return { full, mtime: stat.mtimeMs };
    }),
  );
  stats.sort((a, b) => a.mtime - b.mtime);
  const toDelete = stats.slice(0, stats.length - MAX_BACKUPS);
  await Promise.all(toDelete.map((b) => fs.unlink(b.full).catch(() => undefined)));
}

async function atomicWrite(targetPath: string, content: string): Promise<void> {
  // On Windows the hosts file sits in a system directory the user can't write
  // to — `locus setup` grants Modify on the *file* only, not the directory — so
  // we can't create a sibling temp file there to rename over. Write in place
  // instead: truncate+write only needs WRITE_DATA on the granted file. We lose
  // rename-atomicity, but backupHosts() runs immediately before every write and
  // the file is tiny, so a fresh backup is always available for recovery.
  if (getPlatform() === 'win32') {
    await fs.writeFile(targetPath, content);
    return;
  }
  const tmpPath = `${targetPath}.locus.tmp`;
  await fs.writeFile(tmpPath, content, { mode: 0o644 });
  await fs.rename(tmpPath, targetPath);
}

function stripBlock(lines: string[], block: BlockBoundaries): string[] {
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);
  if (
    before.length > 0 &&
    after.length > 0 &&
    before[before.length - 1]?.trim() === '' &&
    after[0]?.trim() === ''
  ) {
    after.shift();
  }
  return [...before, ...after];
}

export async function writeBlock(
  hostnames: string[],
  opts?: HostsOpts,
): Promise<{ backupPath: string }> {
  const { hostsPath, backupDir } = resolvePaths(opts);
  const backupPath = await backupHosts(hostsPath, backupDir);
  const original = await fs.readFile(hostsPath, 'utf8');
  const lines = original.split('\n');
  const trailingNewline = original.endsWith('\n');

  const blockLines = buildBlock(hostnames);
  const existing = findBlock(lines);
  let nextLines: string[];
  if (existing) {
    nextLines = [
      ...lines.slice(0, existing.startLine),
      ...blockLines,
      ...lines.slice(existing.endLine + 1),
    ];
  } else {
    nextLines = [...lines];
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] === '') nextLines.pop();
    if (nextLines.length > 0) nextLines.push('');
    nextLines.push(...blockLines);
  }

  let nextContent = nextLines.join('\n');
  if (trailingNewline && !nextContent.endsWith('\n')) nextContent += '\n';
  await atomicWrite(hostsPath, nextContent);
  return { backupPath };
}

export async function clearBlock(
  opts?: HostsOpts,
): Promise<{ backupPath: string } | null> {
  const { hostsPath, backupDir } = resolvePaths(opts);
  const original = await fs.readFile(hostsPath, 'utf8');
  const lines = original.split('\n');
  const block = findBlock(lines);
  if (!block) return null;
  const backupPath = await backupHosts(hostsPath, backupDir);
  const trailingNewline = original.endsWith('\n');
  const nextLines = stripBlock(lines, block);
  let nextContent = nextLines.join('\n');
  if (trailingNewline && !nextContent.endsWith('\n')) nextContent += '\n';
  await atomicWrite(hostsPath, nextContent);
  return { backupPath };
}

export async function getActiveBlock(opts?: HostsOpts): Promise<string[]> {
  const { hostsPath } = resolvePaths(opts);
  let original: string;
  try {
    original = await fs.readFile(hostsPath, 'utf8');
  } catch {
    return [];
  }
  const lines = original.split('\n');
  const block = findBlock(lines);
  if (!block) return [];
  const inner = lines.slice(block.startLine + 1, block.endLine);
  const hosts = new Set<string>();
  for (const raw of inner) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2 || parts[0] !== '127.0.0.1') continue;
    const host = parts[1];
    if (!host) continue;
    hosts.add(host.startsWith('www.') ? host.slice(4) : host);
  }
  return [...hosts].sort();
}
