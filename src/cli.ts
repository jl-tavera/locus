import { Command } from 'commander';
import { recover } from './core/lock.js';

async function fail(err: unknown): Promise<never> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`error: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  await recover();

  const program = new Command();
  program
    .name('locus')
    .description('keep sites locked by default; solve a challenge to unlock for a few minutes.')
    .version('0.1.0');

  program
    .command('add <url>')
    .description('add a site to the library (does not block yet)')
    .action(async (url: string) => {
      const { runAdd } = await import('./commands/add.js');
      await runAdd(url).catch(fail);
    });

  program
    .command('remove <url>')
    .alias('rm')
    .description('remove a site from the library (and from every profile)')
    .action(async (url: string) => {
      const { runRemove } = await import('./commands/remove.js');
      await runRemove(url).catch(fail);
    });

  program
    .command('list')
    .description('list every site in the library')
    .action(async () => {
      const { runList } = await import('./commands/list.js');
      await runList().catch(fail);
    });

  const profile = program.command('profile').description('manage profiles');
  profile
    .command('create <name>')
    .description('create a new profile')
    .action(async (name: string) => {
      const { runProfileCreate } = await import('./commands/profile.js');
      await runProfileCreate(name).catch(fail);
    });
  profile
    .command('delete <name>')
    .description('delete a profile')
    .action(async (name: string) => {
      const { runProfileDelete } = await import('./commands/profile.js');
      await runProfileDelete(name).catch(fail);
    });
  profile
    .command('list')
    .description('list all profiles')
    .action(async () => {
      const { runProfileList } = await import('./commands/profile.js');
      await runProfileList().catch(fail);
    });
  profile
    .command('add <profile> <url>')
    .description('add an existing library site to a profile')
    .action(async (profileName: string, url: string) => {
      const { runProfileAdd } = await import('./commands/profile.js');
      await runProfileAdd(profileName, url).catch(fail);
    });
  profile
    .command('remove <profile> <url>')
    .description('remove a site from a profile (does not delete the site)')
    .action(async (profileName: string, url: string) => {
      const { runProfileRemove } = await import('./commands/profile.js');
      await runProfileRemove(profileName, url).catch(fail);
    });

  program
    .command('lock [profile]')
    .description('block the locked set now (optionally switch which profile/all is locked)')
    .action(async (profileName: string | undefined) => {
      const { runLock } = await import('./commands/lock.js');
      await runLock(profileName).catch(fail);
    });

  program
    .command('relock')
    .description('re-lock now, ending any active unlock (used by the auto re-lock task)')
    .action(async () => {
      const { runRelock } = await import('./commands/relock.js');
      await runRelock().catch(fail);
    });

  program
    .command('status')
    .description('show whether sites are locked or temporarily unlocked')
    .action(async () => {
      const { runStatus } = await import('./commands/status.js');
      await runStatus().catch(fail);
    });

  program
    .command('streak')
    .description('show the unlock-history calendar and current streak')
    .action(async () => {
      const { runStreak } = await import('./commands/streak.js');
      await runStreak().catch(fail);
    });

  program
    .command('setup')
    .description('one-time setup: grant your Windows user write access to the hosts file')
    .action(async () => {
      const { runSetup } = await import('./commands/setup.js');
      await runSetup().catch(fail);
    });

  program.action(async () => {
    const { launchTui } = await import('./ui/launch.js');
    await launchTui().catch(fail);
  });

  await program.parseAsync(process.argv);
}

main().catch(fail);
