import chalk from 'chalk';
import { getUnreadChats } from '../core/graph/chats.js';
import { outputJson } from '../utils/output.js';

export async function unreadCommand(opts: { json?: boolean }): Promise<void> {
  const unread = await getUnreadChats();

  if (opts.json) {
    outputJson(unread);
    return;
  }

  if (unread.length === 0) {
    console.log(chalk.green('✓') + ' All caught up!');
    return;
  }

  console.log(chalk.bold(`${unread.length} unread chat${unread.length > 1 ? 's' : ''}:\n`));
  for (const chat of unread) {
    const preview = chat.lastMessagePreview ? chalk.gray(` — ${chat.lastMessagePreview.slice(0, 60)}`) : '';
    console.log(`  ${chalk.bold(chat.displayName)}  ${chalk.gray(chat.id)}${preview}`);
  }
}
