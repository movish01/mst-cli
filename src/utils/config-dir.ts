import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'mst-cli');

export async function ensureConfigDir(): Promise<string> {
  await mkdir(CONFIG_DIR, { recursive: true });
  return CONFIG_DIR;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getTokenCachePath(): string {
  return join(CONFIG_DIR, 'token-cache.json');
}
