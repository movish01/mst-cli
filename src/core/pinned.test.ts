import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockFileData: string | null = null;
let mockWrittenData: string | null = null;

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => {
    if (mockFileData === null) throw new Error('ENOENT');
    return mockFileData;
  }),
  writeFile: vi.fn(async (_path: string, data: string) => {
    mockWrittenData = data;
  }),
  mkdir: vi.fn(),
}));

vi.mock('../utils/config-dir.js', () => ({
  ensureConfigDir: vi.fn(),
  getPinnedChatsPath: () => '/mock/pinned-chats.json',
}));

// pinned.ts uses a module-level cache, so we need to re-import for each test
// to reset the cache. Use dynamic import with a unique query string trick.
let pinnedModule: typeof import('./pinned.js');

describe('pinned', () => {
  beforeEach(async () => {
    mockFileData = null;
    mockWrittenData = null;
    // Reset module to clear in-memory cache
    vi.resetModules();
    pinnedModule = await import('./pinned.js');
  });

  it('returns empty set when no pinned file exists', async () => {
    const ids = await pinnedModule.getPinnedChatIds();
    expect(ids.size).toBe(0);
  });

  it('returns pinned IDs from file', async () => {
    mockFileData = JSON.stringify([
      { id: 'chat-1', displayName: 'John' },
      { id: 'chat-2', displayName: 'Jane' },
    ]);

    const ids = await pinnedModule.getPinnedChatIds();
    expect(ids.size).toBe(2);
    expect(ids.has('chat-1')).toBe(true);
    expect(ids.has('chat-2')).toBe(true);
  });

  it('isPinned returns true for pinned chat', async () => {
    mockFileData = JSON.stringify([{ id: 'chat-1', displayName: 'John' }]);

    expect(await pinnedModule.isPinned('chat-1')).toBe(true);
    expect(await pinnedModule.isPinned('chat-999')).toBe(false);
  });

  it('pinChat adds a chat and saves', async () => {
    mockFileData = JSON.stringify([]);

    await pinnedModule.pinChat('chat-1', 'John');
    expect(mockWrittenData).not.toBeNull();
    const saved = JSON.parse(mockWrittenData!);
    expect(saved).toEqual([{ id: 'chat-1', displayName: 'John' }]);
  });

  it('pinChat does not duplicate existing pin', async () => {
    mockFileData = JSON.stringify([{ id: 'chat-1', displayName: 'John' }]);

    await pinnedModule.pinChat('chat-1', 'John');
    // Should not have written (no save call for duplicate)
    expect(mockWrittenData).toBeNull();
  });

  it('unpinChat removes a chat and saves', async () => {
    mockFileData = JSON.stringify([
      { id: 'chat-1', displayName: 'John' },
      { id: 'chat-2', displayName: 'Jane' },
    ]);

    await pinnedModule.unpinChat('chat-1');
    const saved = JSON.parse(mockWrittenData!);
    expect(saved).toEqual([{ id: 'chat-2', displayName: 'Jane' }]);
  });
});
