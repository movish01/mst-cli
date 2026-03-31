import chalk from 'chalk';
import { getChatMessages } from '../core/graph/chats.js';
import { htmlToText } from '../core/graph/html-to-text.js';
import { formatMessageTime } from '../utils/time.js';
import { outputJson } from '../utils/output.js';

export async function messagesCommand(chatId: string, opts: { limit?: string; json?: boolean }): Promise<void> {
  const limit = parseInt(opts.limit || '20', 10);
  const messages = await getChatMessages(chatId, limit);

  if (opts.json) {
    outputJson(messages);
    return;
  }

  if (messages.length === 0) {
    console.log(chalk.yellow('No messages found.'));
    return;
  }

  for (const msg of messages) {
    if (msg.messageType !== 'message') continue;

    const sender = msg.from?.user?.displayName
      || msg.from?.application?.displayName
      || 'System';
    const time = formatMessageTime(msg.createdDateTime);
    const body = msg.body.contentType === 'html'
      ? htmlToText(msg.body.content)
      : msg.body.content;

    console.log(`${chalk.bold(sender)}  ${chalk.gray(time)}`);
    console.log(`  ${body}`);
    console.log();
  }
}
