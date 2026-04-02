import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockApiChain = {
  top: vi.fn().mockReturnThis(),
  orderby: vi.fn().mockReturnThis(),
  get: mockGet,
  post: mockPost,
};

vi.mock('./graph-client.js', () => ({
  getGraphClient: () => ({
    api: () => mockApiChain,
  }),
}));

const { getJoinedTeams, getTeamChannels, getChannelMessages, sendChannelMessage } = await import('./teams.js');

describe('getJoinedTeams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns teams from API', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        { id: 'team-1', displayName: 'Engineering', description: 'Eng team' },
        { id: 'team-2', displayName: 'Product', description: null },
      ],
    });

    const teams = await getJoinedTeams();
    expect(teams).toHaveLength(2);
    expect(teams[0].displayName).toBe('Engineering');
  });
});

describe('getTeamChannels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns channels from API', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        { id: 'ch-1', displayName: 'general', description: null, membershipType: 'standard' },
      ],
    });

    const channels = await getTeamChannels('team-1');
    expect(channels).toHaveLength(1);
    expect(channels[0].displayName).toBe('general');
  });
});

describe('getChannelMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns messages in chronological order', async () => {
    mockGet.mockResolvedValueOnce({
      value: [
        { id: '2', body: { content: 'second' } },
        { id: '1', body: { content: 'first' } },
      ],
    });

    const messages = await getChannelMessages('team-1', 'ch-1');
    expect(messages[0].id).toBe('1');
    expect(messages[1].id).toBe('2');
  });
});

describe('sendChannelMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts message and returns response', async () => {
    mockPost.mockResolvedValueOnce({
      id: 'msg-1',
      body: { content: 'hello', contentType: 'text' },
    });

    const result = await sendChannelMessage('team-1', 'ch-1', 'hello');
    expect(result.id).toBe('msg-1');
    expect(mockPost).toHaveBeenCalledWith({ body: { content: 'hello' } });
  });
});
