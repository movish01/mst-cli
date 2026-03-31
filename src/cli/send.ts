import chalk from 'chalk';
import Fuse from 'fuse.js';
import { getChatList, sendChatMessage } from '../core/graph/chats.js';
import { outputJson } from '../utils/output.js';

export async function sendCommand(chatId: string, message: string | undefined, opts: { to?: string; json?: boolean }): Promise<void> {
  let targetChatId = chatId;

  // If --to flag is used, find the chat by name
  if (opts.to) {
    const chats = await getChatList();
    const fuse = new Fuse(chats, { keys: ['displayName'], threshold: 0.4 });
    const results = fuse.search(opts.to);

    if (results.length === 0) {
      console.error(chalk.red(`No chat found matching "${opts.to}"`));
      process.exit(1);
    }

    targetChatId = results[0].item.id;
    if (!opts.json) {
      console.log(chalk.gray(`Matched: ${results[0].item.displayName}`));
    }
  }

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

  const result = await sendChatMessage(targetChatId, content);

  if (opts.json) {
    outputJson(result);
    return;
  }

  console.log(chalk.green('✓') + ' Message sent');
}
