import { Command } from 'commander';
import { recoverFocus } from './core/focus.js';

async function fail(err: unknown): Promise<never> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`error: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  await recoverFocus();

  const program = new Command();
  program
    .name('locus')
    .description('block sites by editing your hosts file. minimal, monochrome, focused.')
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
    .command('block <profile>')
    .description("write that profile's sites to the hosts file")
    .action(async (profileName: string) => {
      const { runBlock } = await import('./commands/block.js');
      await runBlock(profileName).catch(fail);
    });

  program
    .command('unblock')
    .description('clear the LOCUS block from the hosts file')
    .action(async () => {
      const { runUnblock } = await import('./commands/unblock.js');
      await runUnblock().catch(fail);
    });

  program
    .command('focus <profile> <duration>')
    .description('block a profile for a duration with a live countdown (e.g. 25m, 1h30m)')
    .action(async (profileName: string, duration: string) => {
      const { runFocus } = await import('./commands/focus.js');
      await runFocus(profileName, duration).catch(fail);
    });

  program
    .command('status')
    .description('show current block + active focus state')
    .action(async () => {
      const { runStatus } = await import('./commands/status.js');
      await runStatus().catch(fail);
    });

  program
    .command('streak')
    .description('show focus session calendar and current streak')
    .action(async () => {
      const { runStreak } = await import('./commands/streak.js');
      await runStreak().catch(fail);
    });

  program.action(async () => {
    const { launchTui } = await import('./ui/launch.js');
    await launchTui().catch(fail);
  });

  await program.parseAsync(process.argv);
}

main().catch(fail);
