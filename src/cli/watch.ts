import { getLatestChatMessages } from '../core/graph/chats.js';
import { getChannelMessages } from '../core/graph/teams.js';
import type { ChatMessage } from '../core/graph/types.js';

export async function watchCommand(
  chatId: string,
  opts: { interval?: string; channel?: string },
): Promise<void> {
  const intervalMs = parseInt(opts.interval || '4000', 10);
  const isChannel = !!opts.channel;
  const [teamId, channelId] = isChannel ? opts.channel!.split(':') : [null, null];

  // Fetch initial messages to seed the seen set
  let initial: ChatMessage[];
  if (isChannel && teamId && channelId) {
    initial = await getChannelMessages(teamId, channelId, 5);
  } else {
    initial = await getLatestChatMessages(chatId, 5);
  }

  const seenIds = new Set<string>(initial.map((m) => m.id));

  // Poll and stream new messages as JSON lines
  const poll = async () => {
    try {
      let latest: ChatMessage[];
      if (isChannel && teamId && channelId) {
        latest = await getChannelMessages(teamId, channelId, 5);
      } else {
        latest = await getLatestChatMessages(chatId, 5);
      }

      for (const msg of latest) {
        if (seenIds.has(msg.id)) continue;
        seenIds.add(msg.id);
        if (msg.messageType !== 'message') continue;
        console.log(JSON.stringify(msg));
      }
    } catch (err) {
      console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const interval = setInterval(poll, intervalMs);

  // Graceful shutdown on SIGINT
  process.on('SIGINT', () => {
    clearInterval(interval);
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}
