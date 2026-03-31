import chalk from 'chalk';
import { getJoinedTeams } from '../core/graph/teams.js';
import { outputJson } from '../utils/output.js';

export async function teamsCommand(opts: { json?: boolean }): Promise<void> {
  const teams = await getJoinedTeams();

  if (opts.json) {
    outputJson(teams);
    return;
  }

  if (teams.length === 0) {
    console.log(chalk.yellow('No teams found.'));
    return;
  }

  for (const team of teams) {
    console.log(`  ${chalk.bold(team.displayName)}`);
    if (team.description) {
      console.log(`    ${chalk.gray(team.description)}`);
    }
  }
}
