import { readFile, writeFile } from 'node:fs/promises';
import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';
import { ensureConfigDir, getTokenCachePath } from '../../utils/config-dir.js';

export const tokenCachePlugin: ICachePlugin = {
  async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    try {
      const data = await readFile(getTokenCachePath(), 'utf-8');
      cacheContext.tokenCache.deserialize(data);
    } catch {
      // File doesn't exist yet — first run
    }
  },

  async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    if (cacheContext.cacheHasChanged) {
      await ensureConfigDir();
      await writeFile(getTokenCachePath(), cacheContext.tokenCache.serialize(), 'utf-8');
    }
  },
};
