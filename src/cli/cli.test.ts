import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../core/graph/chats.js', () => ({
  getChatList: vi.fn(),
  getChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
}));

vi.mock('../utils/output.js', () => ({
  outputJson: vi.fn(),
}));

const { getChatList, getChatMessages, sendChatMessage } = await import('../core/graph/chats.js');
const { outputJson } = await import('../utils/output.js');
const { chatsCommand } = await import('./chats.js');
const { messagesCommand } = await import('./messages.js');

describe('chatsCommand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('outputs JSON when --json flag is set', async () => {
    const mockChats = [
      { id: '1', type: 'oneOnOne' as const, displayName: 'John', lastMessagePreview: null, lastMessageTime: null },
    ];
    vi.mocked(getChatList).mockResolvedValueOnce(mockChats);

    await chatsCommand({ json: true });
    expect(outputJson).toHaveBeenCalledWith(mockChats);
  });

  it('prints message when no chats found', async () => {
    vi.mocked(getChatList).mockResolvedValueOnce([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await chatsCommand({});
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No chats found');
    spy.mockRestore();
  });

  it('prints chat list for human output', async () => {
    vi.mocked(getChatList).mockResolvedValueOnce([
      { id: '1', type: 'oneOnOne' as const, displayName: 'John Smith', lastMessagePreview: null, lastMessageTime: '2026-04-01T10:00:00Z' },
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await chatsCommand({});
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('John Smith');
    spy.mockRestore();
  });
});

describe('messagesCommand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('outputs JSON when --json flag is set', async () => {
    const mockMessages = [
      { id: 'm1', messageType: 'message', body: { content: 'hi', contentType: 'text' as const }, createdDateTime: '2026-04-01T10:00:00Z', from: { user: { id: 'u1', displayName: 'John' } } },
    ];
    vi.mocked(getChatMessages).mockResolvedValueOnce(mockMessages);

    await messagesCommand('chat-1', { json: true });
    expect(outputJson).toHaveBeenCalledWith(mockMessages);
  });

  it('passes limit option to getChatMessages', async () => {
    vi.mocked(getChatMessages).mockResolvedValueOnce([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await messagesCommand('chat-1', { limit: '5' });
    expect(getChatMessages).toHaveBeenCalledWith('chat-1', 5);
    spy.mockRestore();
  });

  it('prints "No messages" when empty', async () => {
    vi.mocked(getChatMessages).mockResolvedValueOnce([]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await messagesCommand('chat-1', {});
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No messages');
    spy.mockRestore();
  });
});
