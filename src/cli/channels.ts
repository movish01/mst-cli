import chalk from 'chalk';
import { getTeamChannels } from '../core/graph/teams.js';
import { outputJson } from '../utils/output.js';

export async function channelsCommand(teamId: string, opts: { json?: boolean }): Promise<void> {
  const channels = await getTeamChannels(teamId);

  if (opts.json) {
    outputJson(channels);
    return;
  }

  if (channels.length === 0) {
    console.log(chalk.yellow('No channels found.'));
    return;
  }

  for (const ch of channels) {
    console.log(`  ${chalk.bold('#' + ch.displayName)}`);
    if (ch.description) {
      console.log(`    ${chalk.gray(ch.description)}`);
    }
  }
}
