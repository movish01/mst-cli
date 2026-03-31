import chalk from 'chalk';
import { getChatList } from '../core/graph/chats.js';
import { formatRelativeTime } from '../utils/time.js';
import { outputJson } from '../utils/output.js';

export async function chatsCommand(opts: { json?: boolean }): Promise<void> {
  const chats = await getChatList();

  if (opts.json) {
    outputJson(chats);
    return;
  }

  if (chats.length === 0) {
    console.log(chalk.yellow('No chats found.'));
    return;
  }

  for (const chat of chats) {
    const time = chat.lastMessageTime
      ? chalk.gray(formatRelativeTime(chat.lastMessageTime).padStart(10))
      : '';
    const typeTag = chat.type === 'group' ? chalk.gray(' (group)') : '';
    console.log(`  ${chalk.bold(chat.displayName)}${typeTag}  ${time}`);
  }
}
