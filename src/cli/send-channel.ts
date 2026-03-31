import chalk from 'chalk';
import { sendChannelMessage } from '../core/graph/teams.js';
import { outputJson } from '../utils/output.js';

export async function sendChannelCommand(teamId: string, channelId: string, message: string | undefined, opts: { json?: boolean }): Promise<void> {
  // Read message from stdin if not provided
  let content = message;
  if (!content) {
    if (!process.stdin.isTTY) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      content = Buffer.concat(chunks).toString('utf-8').trim();
    }
  }

  if (!content) {
    console.error(chalk.red('No message provided. Pass as argument or pipe via stdin.'));
    process.exit(1);
  }

  const result = await sendChannelMessage(teamId, channelId, content);

  if (opts.json) {
    outputJson(result);
    return;
  }

  console.log(chalk.green('✓') + ' Message sent to channel');
}
