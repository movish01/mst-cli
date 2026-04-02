import { describe, it, expect, beforeEach } from 'vitest';
import { completer, setCachedConversations } from './completer.js';
import type { ConversationItem } from '../core/graph/types.js';

function callCompleter(line: string): Promise<[string[], string]> {
  return new Promise((resolve) => {
    completer(line, (err, result) => resolve(result));
  });
}

const mockConversations: ConversationItem[] = [
  { id: '1', type: 'oneOnOne', displayName: 'John Smith', lastMessagePreview: null, lastMessageTime: null },
  { id: '2', type: 'oneOnOne', displayName: 'Jane Doe', lastMessagePreview: null, lastMessageTime: null },
  { id: '3', type: 'group', displayName: 'Project Alpha', lastMessagePreview: null, lastMessageTime: null },
];

describe('completer', () => {
  beforeEach(() => {
    setCachedConversations(mockConversations);
  });

  it('completes command names', async () => {
    const [matches] = await callCompleter('ch');
    expect(matches).toContain('chats');
  });

  it('completes multiple matching commands', async () => {
    const [matches] = await callCompleter('s');
    expect(matches).toContain('search');
    expect(matches).toContain('status');
  });

  it('returns all commands for empty input', async () => {
    const [matches] = await callCompleter('');
    expect(matches.length).toBeGreaterThan(5);
  });

  it('completes chat names after "open "', async () => {
    const [matches] = await callCompleter('open jo');
    expect(matches).toEqual(['open "John Smith"']);
  });

  it('completes chat names after "find "', async () => {
    const [matches] = await callCompleter('find ja');
    expect(matches).toEqual(['find "Jane Doe"']);
  });

  it('completes chat names after "pin "', async () => {
    const [matches] = await callCompleter('pin pro');
    expect(matches).toEqual(['pin "Project Alpha"']);
  });

  it('returns empty for no match', async () => {
    const [matches] = await callCompleter('open zzz');
    expect(matches).toEqual([]);
  });

  it('is case insensitive for commands', async () => {
    const [matches] = await callCompleter('CH');
    expect(matches).toContain('chats');
  });

  it('is case insensitive for chat names', async () => {
    const [matches] = await callCompleter('open JOHN');
    expect(matches).toEqual(['open "John Smith"']);
  });
});
