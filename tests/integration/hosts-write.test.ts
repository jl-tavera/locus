import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, existsSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { writeBlock, clearBlock, getActiveBlock, SENTINEL_START, SENTINEL_END } from '../../src/core/hosts.js';
import { makeTmpHosts, type TmpHosts } from '../helpers/tmp-env.js';

describe('hosts writeBlock / clearBlock / getActiveBlock', () => {
  let tmp: TmpHosts;

  beforeEach(() => {
    tmp = makeTmpHosts('127.0.0.1 localhost\n255.255.255.255 broadcasthost\n');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('writes the managed block with both bare and www entries', async () => {
    await writeBlock(['example.com'], { path: tmp.hostsPath, backupDir: tmp.backupDir });
    const content = readFileSync(tmp.hostsPath, 'utf8');
    expect(content).toContain(SENTINEL_START);
    expect(content).toContain(SENTINEL_END);
    expect(content).toContain('127.0.0.1 example.com');
    expect(content).toContain('127.0.0.1 www.example.com');
  });

  it('preserves existing user lines around the block', async () => {
    await writeBlock(['example.com'], { path: tmp.hostsPath, backupDir: tmp.backupDir });
    const content = readFileSync(tmp.hostsPath, 'utf8');
    expect(content).toContain('127.0.0.1 localhost');
    expect(content).toContain('255.255.255.255 broadcasthost');
  });

  it('round-trips through getActiveBlock (strips www., dedupes, sorts)', async () => {
    await writeBlock(['twitter.com', 'reddit.com'], { path: tmp.hostsPath, backupDir: tmp.backupDir });
    const active = await getActiveBlock({ path: tmp.hostsPath });
    expect(active).toEqual(['reddit.com', 'twitter.com']);
  });

  it('replaces the existing block on rewrite (no duplicates)', async () => {
    await writeBlock(['twitter.com'], { path: tmp.hostsPath, backupDir: tmp.backupDir });
    await writeBlock(['reddit.com'], { path: tmp.hostsPath, backupDir: tmp.backupDir });
    const content = readFileSync(tmp.hostsPath, 'utf8');
    expect(content).not.toContain('127.0.0.1 twitter.com');
    expect(content).toContain('127.0.0.1 reddit.com');
    expect(content.match(/# >>> LOCUS START/g)?.length).toBe(1);
  });

  it('atomic rename leaves no .locus.tmp behind', async () => {
    await writeBlock(['example.com'], { path: tmp.hostsPath, backupDir: tmp.backupDir });
    expect(existsSync(`${tmp.hostsPath}.locus.tmp`)).toBe(false);
  });

  it('creates a backup file in backupDir', async () => {
    const { backupPath } = await writeBlock(['example.com'], {
      path: tmp.hostsPath,
      backupDir: tmp.backupDir,
    });
    expect(existsSync(backupPath)).toBe(true);
    expect(backupPath.startsWith(tmp.backupDir)).toBe(true);
  });

  it('prunes backups to the most recent 10 by mtime', async () => {
    // seed 12 fake old backups with staggered mtimes so we can verify the
    // oldest get pruned (not just any 2)
    const { mkdirSync } = await import('node:fs');
    mkdirSync(tmp.backupDir, { recursive: true });
    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      const p = join(tmp.backupDir, `hosts.fake-${i}.bak`);
      writeFileSync(p, `seed-${i}`);
      const t = (now - (12 - i) * 1000) / 1000; // older first
      utimesSync(p, t, t);
    }
    // trigger a real write — pruneBackups runs after backupHosts, so we end up
    // with 10 fakes + 1 real = 11 total, then pruning kicks in to drop 1
    await writeBlock(['example.com'], { path: tmp.hostsPath, backupDir: tmp.backupDir });
    const remaining = readdirSync(tmp.backupDir).filter((f) => f.startsWith('hosts.') && f.endsWith('.bak'));
    expect(remaining.length).toBeLessThanOrEqual(10);
    // oldest fake should be gone
    expect(remaining).not.toContain('hosts.fake-0.bak');
  });

  it('clearBlock removes the managed region but keeps user lines', async () => {
    await writeBlock(['example.com'], { path: tmp.hostsPath, backupDir: tmp.backupDir });
    const result = await clearBlock({ path: tmp.hostsPath, backupDir: tmp.backupDir });
    expect(result).not.toBeNull();
    const content = readFileSync(tmp.hostsPath, 'utf8');
    expect(content).not.toContain(SENTINEL_START);
    expect(content).not.toContain(SENTINEL_END);
    expect(content).toContain('127.0.0.1 localhost');
    expect(content).toContain('255.255.255.255 broadcasthost');
  });

  it('clearBlock returns null when no block is present', async () => {
    const result = await clearBlock({ path: tmp.hostsPath, backupDir: tmp.backupDir });
    expect(result).toBeNull();
  });

  it('getActiveBlock returns [] when no block is present', async () => {
    expect(await getActiveBlock({ path: tmp.hostsPath })).toEqual([]);
  });

  it('getActiveBlock returns [] when the hosts file is missing', async () => {
    expect(await getActiveBlock({ path: join(tmp.hostsPath, 'does-not-exist') })).toEqual([]);
  });
});
