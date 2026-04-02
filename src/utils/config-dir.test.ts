import { describe, it, expect } from 'vitest';
import { getConfigDir, getTokenCachePath, getPinnedChatsPath } from './config-dir.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

describe('config-dir paths', () => {
  const expectedBase = join(homedir(), '.config', 'mst-cli');

  it('getConfigDir returns correct base path', () => {
    expect(getConfigDir()).toBe(expectedBase);
  });

  it('getTokenCachePath returns path under config dir', () => {
    expect(getTokenCachePath()).toBe(join(expectedBase, 'token-cache.json'));
  });

  it('getPinnedChatsPath returns path under config dir', () => {
    expect(getPinnedChatsPath()).toBe(join(expectedBase, 'pinned-chats.json'));
  });
});
