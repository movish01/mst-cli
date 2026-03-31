import chalk from 'chalk';
import * as readline from 'node:readline';
import type { ConversationItem, ChatMessage } from '../core/graph/types.js';
import { getChatMessages, sendChatMessage, getNewChatMessages } from '../core/graph/chats.js';
import { getChannelMessages, sendChannelMessage } from '../core/graph/teams.js';
import { htmlToText } from '../core/graph/html-to-text.js';
import { formatMessageTime } from '../utils/time.js';
import { chatPrompt } from './prompt.js';
import { authService } from '../core/auth/auth-service.js';

function formatMessage(msg: ChatMessage, currentUserId: string | null): string {
  const sender = msg.from?.user?.displayName
    || msg.from?.application?.displayName
    || 'System';
  const time = formatMessageTime(msg.createdDateTime);
  const body = msg.body.contentType === 'html'
    ? htmlToText(msg.body.content)
    : msg.body.content;

  const isMe = msg.from?.user?.id === currentUserId;
  const senderStyled = isMe
    ? chalk.green.bold(sender)
    : chalk.bold(sender);

  return `${senderStyled}  ${chalk.gray(time)}\n  ${body}`;
}

export async function openChatSession(
  conversation: ConversationItem,
  rl: readline.Interface,
): Promise<void> {
  const isChannel = conversation.type === 'channel';
  const currentUser = await authService.getUserInfo();
  const currentUserId = currentUser?.id || null;

  // Print header
  const header = isChannel
    ? `${conversation.displayName}`
    : conversation.displayName;
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.bold(` ${header}`));
  console.log(chalk.gray('─'.repeat(40)));

  // Fetch and display recent messages
  let messages: ChatMessage[];
  if (isChannel && conversation.teamId && conversation.channelId) {
    messages = await getChannelMessages(conversation.teamId, conversation.channelId, 20);
  } else {
    messages = await getChatMessages(conversation.id, 20);
  }

  for (const msg of messages) {
    if (msg.messageType !== 'message') continue;
    console.log(formatMessage(msg, currentUserId));
    console.log();
  }

  console.log(chalk.gray('(type to send, Ctrl+C to go back)\n'));

  // Track last message time for polling
  let lastMessageTime = messages.length > 0
    ? messages[messages.length - 1].createdDateTime
    : new Date().toISOString();

  // Set up polling
  let polling = true;
  const pollInterval = setInterval(async () => {
    if (!polling) return;
    try {
      let newMessages: ChatMessage[];
      if (isChannel && conversation.teamId && conversation.channelId) {
        // Channel messages don't support $filter well, so fetch latest and compare
        const latest = await getChannelMessages(conversation.teamId, conversation.channelId, 5);
        newMessages = latest.filter(
          (m) => new Date(m.createdDateTime) > new Date(lastMessageTime)
        );
      } else {
        newMessages = await getNewChatMessages(conversation.id, lastMessageTime);
      }

      if (newMessages.length > 0) {
        // Clear current line and print new messages
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        for (const msg of newMessages) {
          if (msg.messageType !== 'message') continue;
          console.log(formatMessage(msg, currentUserId));
          console.log();
        }

        lastMessageTime = newMessages[newMessages.length - 1].createdDateTime;

        // Re-display prompt
        rl.prompt();
      }
    } catch {
      // Silently ignore poll errors
    }
  }, 4000);

  // Chat session input loop
  return new Promise<void>((resolve) => {
    const prompt = chatPrompt(conversation.displayName);
    rl.setPrompt(prompt);
    rl.prompt();

    const onLine = async (line: string) => {
      const text = line.trim();
      if (!text) {
        rl.prompt();
        return;
      }

      try {
        if (isChannel && conversation.teamId && conversation.channelId) {
          await sendChannelMessage(conversation.teamId, conversation.channelId, text);
        } else {
          await sendChatMessage(conversation.id, text);
        }
        console.log(chalk.green('✓') + ' Sent');
      } catch (error) {
        console.error(chalk.red('Failed to send:'), error instanceof Error ? error.message : error);
      }

      rl.prompt();
    };

    const onSigint = () => {
      polling = false;
      clearInterval(pollInterval);
      rl.removeListener('line', onLine);
      rl.removeListener('SIGINT', onSigint);
      console.log('\n');
      resolve();
    };

    rl.on('line', onLine);
    rl.on('SIGINT', onSigint);
  });
}
