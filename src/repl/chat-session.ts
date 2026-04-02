import chalk from 'chalk';
import * as readline from 'node:readline';
import type { ConversationItem, ChatMessage } from '../core/graph/types.js';
import { getChatMessages, sendChatMessage, getLatestChatMessages, markChatAsRead, getOlderMessages, getOrCreateChat } from '../core/graph/chats.js';
import { getChannelMessages, sendChannelMessage } from '../core/graph/teams.js';
import { htmlToText } from '../core/graph/html-to-text.js';
import { formatMessageTime } from '../utils/time.js';
import { chatPrompt } from './prompt.js';
import { authService } from '../core/auth/auth-service.js';
import { completer } from './completer.js';
import { setActiveChatSession } from './session-state.js';

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

export interface ChatSession {
  handleLine: (line: string) => Promise<void>;
  cleanup: () => void;
}

export async function openChatSession(
  conversation: ConversationItem,
): Promise<void> {
  // If this is a directory search result, create the chat on demand
  conversation = await getOrCreateChat(conversation);

  const isChannel = conversation.type === 'channel';
  const currentUser = await authService.getUserInfo();
  const currentUserId = currentUser?.id || null;

  // Print header
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.bold(` ${conversation.displayName}`));
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

  // Mark chat as read
  if (!isChannel) {
    markChatAsRead(conversation.id).catch(() => {});
  }

  // Track oldest message time for "more" pagination
  const messageTimestamps = messages.filter(m => m.messageType === 'message');
  let oldestMessageTime = messageTimestamps.length > 0 ? messageTimestamps[0].createdDateTime : null;

  console.log(chalk.gray('(type to send, "more" for history, Ctrl+C to go back)\n'));

  // Track seen message IDs for polling
  const seenMessageIds = new Set<string>(
    messages.map((m) => m.id)
  );

  // Create a dedicated readline for the chat session
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chatPrompt(conversation.displayName),
    completer,
    terminal: true,
  });

  // Set up polling — fetch latest messages and show any new ones
  let polling = true;
  const pollInterval = setInterval(async () => {
    if (!polling) return;
    try {
      let latest: ChatMessage[];
      if (isChannel && conversation.teamId && conversation.channelId) {
        latest = await getChannelMessages(conversation.teamId, conversation.channelId, 5);
      } else {
        latest = await getLatestChatMessages(conversation.id, 5);
      }

      const newMessages = latest.filter((m) => !seenMessageIds.has(m.id));

      if (newMessages.length > 0) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        for (const msg of newMessages) {
          seenMessageIds.add(msg.id);
          if (msg.messageType !== 'message') continue;
          console.log(formatMessage(msg, currentUserId));
          console.log();
        }

        rl.prompt();
      }
    } catch (err) {
      // Log poll errors so we can debug
      console.log(chalk.red(`[poll error] ${err instanceof Error ? err.message : err}`));
    }
  }, 4000);

  rl.prompt();

  // Chat input loop — resolves when user presses Ctrl+C
  return new Promise<void>((resolve) => {
    rl.on('line', async (line) => {
      const text = line.trim();
      if (!text) {
        rl.prompt();
        return;
      }

      // "more" — load older messages
      if (text.toLowerCase() === 'more') {
        if (!oldestMessageTime) {
          console.log(chalk.gray('No more messages to load.'));
          rl.prompt();
          return;
        }
        try {
          let older: ChatMessage[];
          if (isChannel && conversation.teamId && conversation.channelId) {
            // Channel older messages not easily filterable, skip for now
            console.log(chalk.gray('History scrollback not available for channels.'));
            rl.prompt();
            return;
          } else {
            older = await getOlderMessages(conversation.id, oldestMessageTime, 20);
          }

          if (older.length === 0) {
            console.log(chalk.gray('No more messages.'));
          } else {
            console.log(chalk.gray(`── ${older.length} older messages ──`));
            for (const msg of older) {
              seenMessageIds.add(msg.id);
              if (msg.messageType !== 'message') continue;
              console.log(formatMessage(msg, currentUserId));
              console.log();
            }
            const olderFiltered = older.filter(m => m.messageType === 'message');
            if (olderFiltered.length > 0) {
              oldestMessageTime = olderFiltered[0].createdDateTime;
            }
          }
        } catch (err) {
          console.log(chalk.red(`Failed to load history: ${err instanceof Error ? err.message : err}`));
        }
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
    });

    rl.on('SIGINT', () => {
      polling = false;
      clearInterval(pollInterval);
      rl.close();
      console.log('\n');
      resolve();
    });
  });
}
