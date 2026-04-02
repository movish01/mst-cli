import chalk from 'chalk';
import * as readline from 'node:readline';
import { search, select } from '@inquirer/prompts';
import Fuse from 'fuse.js';
import { getChatList, findChatByName } from '../core/graph/chats.js';
import { getJoinedTeams, getTeamChannels } from '../core/graph/teams.js';
import { authService } from '../core/auth/auth-service.js';
import { getPinnedChatIds, pinChat, unpinChat, isPinned } from '../core/pinned.js';
import { formatRelativeTime } from '../utils/time.js';
import { setCachedConversations, getCachedConversations } from './completer.js';
import { openChatSession } from './chat-session.js';
import type { ConversationItem } from '../core/graph/types.js';

async function loadConversations(): Promise<ConversationItem[]> {
  const chats = await getChatList();

  // Filter out meetings
  const filtered = chats.filter((c) => c.type !== 'meeting');

  try {
    const teams = await getJoinedTeams();
    for (const team of teams) {
      const channels = await getTeamChannels(team.id);
      for (const ch of channels) {
        filtered.push({
          id: ch.id,
          type: 'channel',
          displayName: `#${ch.displayName} (${team.displayName})`,
          lastMessagePreview: null,
          lastMessageTime: null,
          teamId: team.id,
          channelId: ch.id,
        });
      }
    }
  } catch {
    // Teams access might fail — continue with chats only
  }

  // Sort: pinned first, then by most recent
  const pinnedIds = await getPinnedChatIds();
  filtered.sort((a, b) => {
    const aPinned = pinnedIds.has(a.id) ? 1 : 0;
    const bPinned = pinnedIds.has(b.id) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });

  setCachedConversations(filtered);
  return filtered;
}

async function makeChoices(conversations: ConversationItem[]) {
  const pinnedIds = await getPinnedChatIds();

  return conversations.map((c) => {
    const time = c.lastMessageTime
      ? chalk.gray(formatRelativeTime(c.lastMessageTime))
      : '';
    const typeTag = c.type === 'channel' ? chalk.blue('channel') :
                    c.type === 'group' ? chalk.gray('group') : '';
    const pin = pinnedIds.has(c.id) ? chalk.yellow('★ ') : '  ';

    return {
      name: `${pin}${c.displayName}  ${typeTag}  ${time}`,
      value: c,
      description: c.lastMessagePreview || undefined,
    };
  });
}

async function selectConversation(
  conversations: ConversationItem[],
  initialFilter?: string,
): Promise<ConversationItem | null> {
  const fuse = new Fuse(conversations, {
    keys: ['displayName'],
    threshold: 0.4,
  });

  try {
    const result = await search<ConversationItem>({
      message: 'Select a chat:',
      source: async (input) => {
        const term = input || initialFilter || '';
        if (!term) return makeChoices(conversations);
        const filtered = fuse.search(term).map((r) => r.item);
        return makeChoices(filtered);
      },
    });
    return result;
  } catch {
    return null;
  }
}

export type CommandHandler = (
  args: string,
  rl: readline.Interface,
) => Promise<void>;

export function getCommands(): Map<string, CommandHandler> {
  const commands = new Map<string, CommandHandler>();

  commands.set('chats', async () => {
    console.log(chalk.gray('Fetching chats...'));
    const conversations = await loadConversations();

    const selected = await selectConversation(conversations);
    if (selected) {
      await openChatSession(selected);
    }
  });

  commands.set('open', async (args) => {
    let conversations = getCachedConversations();
    if (conversations.length === 0) {
      console.log(chalk.gray('Fetching chats...'));
      conversations = await loadConversations();
    }

    if (args) {
      const name = args.replace(/^["']|["']$/g, '');
      const fuse = new Fuse(conversations, { keys: ['displayName'], threshold: 0.4 });
      const results = fuse.search(name);

      if (results.length === 0) {
        console.log(chalk.yellow(`No chat found matching "${name}"`));
        return;
      }

      if (results.length === 1 || results[0].score! < 0.1) {
        await openChatSession(results[0].item);
        return;
      }

      const selected = await selectConversation(results.map((r) => r.item));
      if (selected) {
        await openChatSession(selected);
      }
    } else {
      const selected = await selectConversation(conversations);
      if (selected) {
        await openChatSession(selected);
      }
    }
  });

  commands.set('search', async (args) => {
    let conversations = getCachedConversations();
    if (conversations.length === 0) {
      console.log(chalk.gray('Fetching chats...'));
      conversations = await loadConversations();
    }

    const selected = await selectConversation(conversations, args);
    if (selected) {
      await openChatSession(selected);
    }
  });

  commands.set('pin', async (args) => {
    let conversations = getCachedConversations();
    if (conversations.length === 0) {
      console.log(chalk.gray('Fetching chats...'));
      conversations = await loadConversations();
    }

    if (args) {
      // Pin by name
      const name = args.replace(/^["']|["']$/g, '');
      const fuse = new Fuse(conversations, { keys: ['displayName'], threshold: 0.4 });
      const results = fuse.search(name);

      if (results.length === 0) {
        console.log(chalk.yellow(`No chat found matching "${name}"`));
        return;
      }

      const chat = results[0].item;
      if (await isPinned(chat.id)) {
        await unpinChat(chat.id);
        console.log(chalk.green('✓') + ` Unpinned ${chalk.bold(chat.displayName)}`);
      } else {
        await pinChat(chat.id, chat.displayName);
        console.log(chalk.green('✓') + ` Pinned ${chalk.yellow('★')} ${chalk.bold(chat.displayName)}`);
      }
    } else {
      // Show selector to pick which chat to pin/unpin
      const selected = await selectConversation(conversations);
      if (selected) {
        if (await isPinned(selected.id)) {
          await unpinChat(selected.id);
          console.log(chalk.green('✓') + ` Unpinned ${chalk.bold(selected.displayName)}`);
        } else {
          await pinChat(selected.id, selected.displayName);
          console.log(chalk.green('✓') + ` Pinned ${chalk.yellow('★')} ${chalk.bold(selected.displayName)}`);
        }
      }
    }
  });

  commands.set('teams', async () => {
    console.log(chalk.gray('Fetching teams...'));
    const teams = await getJoinedTeams();

    if (teams.length === 0) {
      console.log(chalk.yellow('No teams found.'));
      return;
    }

    let selectedTeam;
    try {
      selectedTeam = await select({
        message: 'Select a team:',
        choices: teams.map((t) => ({
          name: t.displayName,
          value: t,
          description: t.description || undefined,
        })),
      });
    } catch {
      return;
    }

    console.log(chalk.gray('Fetching channels...'));
    const channels = await getTeamChannels(selectedTeam.id);

    if (channels.length === 0) {
      console.log(chalk.yellow('No channels found.'));
      return;
    }

    let selectedChannel;
    try {
      selectedChannel = await select({
        message: 'Select a channel:',
        choices: channels.map((ch) => ({
          name: `#${ch.displayName}`,
          value: ch,
          description: ch.description || undefined,
        })),
      });
    } catch {
      return;
    }

    const conversation: ConversationItem = {
      id: selectedChannel.id,
      type: 'channel',
      displayName: `${selectedTeam.displayName} > #${selectedChannel.displayName}`,
      lastMessagePreview: null,
      lastMessageTime: null,
      teamId: selectedTeam.id,
      channelId: selectedChannel.id,
    };

    await openChatSession(conversation);
  });

  commands.set('find', async (args) => {
    if (!args) {
      console.log(chalk.yellow('Usage: find <name>'));
      return;
    }

    console.log(chalk.gray(`Searching for "${args}"...`));
    const results = await findChatByName(args);

    if (results.length === 0) {
      console.log(chalk.yellow('No people found.'));
      return;
    }

    const selected = await selectConversation(results);
    if (selected) {
      await openChatSession(selected);
    }
  });

  commands.set('status', async () => {
    const user = await authService.getUserInfo();
    if (user) {
      console.log(chalk.green('✓') + ` ${chalk.bold(user.displayName)} (${user.mail})`);
    } else {
      console.log(chalk.yellow('Not logged in.'));
    }
  });

  commands.set('logout', async () => {
    await authService.logout();
    console.log(chalk.green('✓') + ' Logged out. Run ' + chalk.cyan('mst-cli login') + ' to re-authenticate.');
  });

  commands.set('help', async () => {
    console.log(`
${chalk.bold('Available commands:')}
  ${chalk.cyan('chats')}          List and select a chat to open
  ${chalk.cyan('open')} ${chalk.gray('[name]')}   Open a chat (by name or selector)
  ${chalk.cyan('search')} ${chalk.gray('<query>')} Search loaded chats by name
  ${chalk.cyan('find')} ${chalk.gray('<name>')}   Find a person and open chat (searches entire org)
  ${chalk.cyan('pin')} ${chalk.gray('[name]')}    Pin/unpin a chat (pinned chats show on top)
  ${chalk.cyan('teams')}          Browse teams and channels
  ${chalk.cyan('status')}         Show current user
  ${chalk.cyan('logout')}         Sign out
  ${chalk.cyan('help')}           Show this help
  ${chalk.cyan('exit')}           Quit mst-cli

${chalk.bold('In a chat session:')}
  Just type and press Enter to send a message
  Press ${chalk.cyan('Ctrl+C')} to go back to the main prompt
`);
  });

  return commands;
}
