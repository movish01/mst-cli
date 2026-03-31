import type { ConversationItem } from '../core/graph/types.js';

const COMMANDS = ['chats', 'open', 'search', 'teams', 'help', 'exit', 'quit', 'status', 'logout'];

let cachedConversations: ConversationItem[] = [];

export function setCachedConversations(conversations: ConversationItem[]): void {
  cachedConversations = conversations;
}

export function getCachedConversations(): ConversationItem[] {
  return cachedConversations;
}

export function completer(line: string): [string[], string] {
  // If line starts with "open ", complete chat names
  if (line.startsWith('open ')) {
    const partial = line.slice(5).toLowerCase();
    const matches = cachedConversations
      .filter((c) => c.displayName.toLowerCase().includes(partial))
      .map((c) => `open "${c.displayName}"`);
    return [matches.length ? matches : [], line];
  }

  // Complete command names
  const matches = COMMANDS.filter((cmd) => cmd.startsWith(line.toLowerCase()));
  return [matches, line];
}
