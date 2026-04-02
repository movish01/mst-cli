import type { ConversationItem } from '../core/graph/types.js';

const COMMANDS = ['chats', 'open', 'search', 'find', 'teams', 'help', 'exit', 'quit', 'status', 'logout'];

let cachedConversations: ConversationItem[] = [];

export function setCachedConversations(conversations: ConversationItem[]): void {
  cachedConversations = conversations;
}

export function getCachedConversations(): ConversationItem[] {
  return cachedConversations;
}

export function completer(line: string): [string[], string] {
  // "open <partial>" or "find <partial>" — complete chat names
  const openMatch = line.match(/^(open|find)\s+(.*)/i);
  if (openMatch) {
    const cmd = openMatch[1];
    const partial = openMatch[2].replace(/^["']/, '').toLowerCase();
    const matches = cachedConversations
      .filter((c) => c.displayName.toLowerCase().includes(partial))
      .map((c) => `${cmd} "${c.displayName}"`);
    return [matches.length ? matches : [], line];
  }

  // Complete command names
  const trimmed = line.trimStart();
  const matches = COMMANDS.filter((cmd) => cmd.startsWith(trimmed.toLowerCase()));
  return [matches, trimmed];
}
