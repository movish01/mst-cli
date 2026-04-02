import type { ConversationItem } from '../core/graph/types.js';

const COMMANDS = ['chats', 'open', 'search', 'find', 'pin', 'unread', 'teams', 'help', 'exit', 'quit', 'status', 'logout'];

let cachedConversations: ConversationItem[] = [];

export function setCachedConversations(conversations: ConversationItem[]): void {
  cachedConversations = conversations;
}

export function getCachedConversations(): ConversationItem[] {
  return cachedConversations;
}

export function completer(
  line: string,
  callback: (err: Error | null, result: [string[], string]) => void,
): void {
  // "open <partial>" or "find <partial>" — complete chat names
  const openMatch = line.match(/^(open|find|pin)\s+(.*)/i);
  if (openMatch) {
    const cmd = openMatch[1];
    const partial = openMatch[2].replace(/^["']/, '').toLowerCase();

    const complete = () => {
      const matches = cachedConversations
        .filter((c) => c.displayName.toLowerCase().includes(partial))
        .map((c) => `${cmd} "${c.displayName}"`);
      callback(null, [matches.length ? matches : [], line]);
    };

    if (cachedConversations.length === 0 && loadConversationsFunc) {
      loadConversationsFunc().then(complete).catch(() => complete());
    } else {
      complete();
    }
    return;
  }

  // Complete command names
  const trimmed = line.trimStart();
  const matches = COMMANDS.filter((cmd) => cmd.startsWith(trimmed.toLowerCase()));
  callback(null, [matches, trimmed]);
}

let loadConversationsFunc: (() => Promise<void>) | null = null;

export function setConversationLoader(fn: () => Promise<void>): void {
  loadConversationsFunc = fn;
}
