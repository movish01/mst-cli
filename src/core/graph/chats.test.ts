import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock graph client
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockApiChain = {
  select: vi.fn().mockReturnThis(),
  expand: vi.fn().mockReturnThis(),
  top: vi.fn().mockReturnThis(),
  orderby: vi.fn().mockReturnThis(),
  header: vi.fn().mockReturnThis(),
  search: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  get: mockGet,
  post: mockPost,
};

vi.mock('./graph-client.js', () => ({
  getGraphClient: () => ({
    api: () => mockApiChain,
  }),
}));

vi.mock('../auth/auth-service.js', () => ({
  authService: {
    getUserInfo: vi.fn().mockResolvedValue({ id: 'user-1', displayName: 'Test User', mail: 'test@test.com' }),
    getAccessToken: vi.fn().mockResolvedValue('mock-token'),
  },
}));

const { getChatList, getChatMessages, sendChatMessage, getLatestChatMessages } = await import('./chats.js');

describe('getChatList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns formatted chat list from API response', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        {
          id: 'chat-1',
          chatType: 'oneOnOne',
          topic: null,
          lastUpdatedDateTime: '2026-04-01T10:00:00Z',
          members: [
            { userId: 'user-1', displayName: 'Test User' },
            { userId: 'user-2', displayName: 'John Smith' },
          ],
          lastMessagePreview: {
            body: { content: '<p>hello</p>' },
            createdDateTime: '2026-04-01T10:00:00Z',
          },
          viewpoint: { lastMessageReadDateTime: '2026-04-01T10:00:00Z' },
        },
      ],
    });

    const chats = await getChatList();
    expect(chats).toHaveLength(1);
    expect(chats[0].displayName).toBe('John Smith');
    expect(chats[0].type).toBe('oneOnOne');
    expect(chats[0].lastMessagePreview).toBe('hello');
  });

  it('uses topic as displayName when available', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        {
          id: 'chat-2',
          chatType: 'group',
          topic: 'Project Alpha',
          lastUpdatedDateTime: '2026-04-01T10:00:00Z',
          members: [],
          lastMessagePreview: null,
          viewpoint: null,
        },
      ],
    });

    const chats = await getChatList();
    expect(chats[0].displayName).toBe('Project Alpha');
  });

  it('joins member names for group chats without topic', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        {
          id: 'chat-3',
          chatType: 'group',
          topic: null,
          lastUpdatedDateTime: '2026-04-01T10:00:00Z',
          members: [
            { userId: 'user-1', displayName: 'Test User' },
            { userId: 'user-2', displayName: 'Alice' },
            { userId: 'user-3', displayName: 'Bob' },
          ],
          lastMessagePreview: null,
          viewpoint: null,
        },
      ],
    });

    const chats = await getChatList();
    expect(chats[0].displayName).toBe('Alice, Bob');
  });

  it('filters out hidden chats', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        {
          id: 'chat-hidden',
          chatType: 'oneOnOne',
          topic: null,
          lastUpdatedDateTime: '2026-04-01T10:00:00Z',
          members: [
            { userId: 'user-1', displayName: 'Test User' },
            { userId: 'user-2', displayName: 'Hidden Person' },
          ],
          lastMessagePreview: null,
          viewpoint: { isHidden: true },
        },
      ],
    });

    const chats = await getChatList();
    expect(chats).toHaveLength(0);
  });

  it('filters out meeting chats with no messages', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        {
          id: 'meeting-1',
          chatType: 'meeting',
          topic: 'Standup',
          lastUpdatedDateTime: '2026-04-01T10:00:00Z',
          members: [],
          lastMessagePreview: null,
          viewpoint: null,
        },
      ],
    });

    const chats = await getChatList();
    expect(chats).toHaveLength(0);
  });

  it('keeps meeting chats that have messages', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        {
          id: 'meeting-2',
          chatType: 'meeting',
          topic: 'Standup',
          lastUpdatedDateTime: '2026-04-01T10:00:00Z',
          members: [],
          lastMessagePreview: {
            body: { content: 'notes from meeting' },
            createdDateTime: '2026-04-01T10:00:00Z',
          },
          viewpoint: null,
        },
      ],
    });

    const chats = await getChatList();
    expect(chats).toHaveLength(1);
    expect(chats[0].type).toBe('meeting');
  });

  it('marks unread chats when last message is newer than last read', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        {
          id: 'chat-unread',
          chatType: 'oneOnOne',
          topic: null,
          lastUpdatedDateTime: '2026-04-01T12:00:00Z',
          members: [
            { userId: 'user-1', displayName: 'Test User' },
            { userId: 'user-2', displayName: 'Someone' },
          ],
          lastMessagePreview: {
            body: { content: 'new message' },
            createdDateTime: '2026-04-01T12:00:00Z',
          },
          viewpoint: { lastMessageReadDateTime: '2026-04-01T10:00:00Z' },
        },
      ],
    });

    const chats = await getChatList();
    expect(chats[0].unreadCount).toBe(1);
  });

  it('sorts chats by most recent first', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        {
          id: 'old',
          chatType: 'oneOnOne',
          topic: 'Old Chat',
          lastUpdatedDateTime: '2026-03-01T10:00:00Z',
          members: [],
          lastMessagePreview: null,
          viewpoint: null,
        },
        {
          id: 'new',
          chatType: 'oneOnOne',
          topic: 'New Chat',
          lastUpdatedDateTime: '2026-04-01T10:00:00Z',
          members: [],
          lastMessagePreview: null,
          viewpoint: null,
        },
      ],
    });

    const chats = await getChatList();
    expect(chats[0].displayName).toBe('New Chat');
    expect(chats[1].displayName).toBe('Old Chat');
  });
});

describe('getChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns messages in chronological order', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        { id: '2', body: { content: 'second' }, createdDateTime: '2026-04-01T10:01:00Z' },
        { id: '1', body: { content: 'first' }, createdDateTime: '2026-04-01T10:00:00Z' },
      ],
    });

    const messages = await getChatMessages('chat-1');
    // Should be reversed (API returns desc, we reverse to chronological)
    expect(messages[0].id).toBe('1');
    expect(messages[1].id).toBe('2');
  });
});

describe('getLatestChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns latest messages reversed', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        { id: 'b', body: { content: 'newer' } },
        { id: 'a', body: { content: 'older' } },
      ],
    });

    const messages = await getLatestChatMessages('chat-1', 2);
    expect(messages[0].id).toBe('a');
    expect(messages[1].id).toBe('b');
  });
});

describe('sendChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts message and returns response', async () => {
    const mockResponse = {
      id: 'msg-1',
      body: { content: 'hello', contentType: 'text' },
      createdDateTime: '2026-04-01T10:00:00Z',
    };
    mockPost.mockResolvedValueOnce(mockResponse);

    const result = await sendChatMessage('chat-1', 'hello');
    expect(result.id).toBe('msg-1');
    expect(mockPost).toHaveBeenCalledWith({ body: { content: 'hello' } });
  });
});
