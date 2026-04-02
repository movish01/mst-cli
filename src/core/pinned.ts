import { readFile, writeFile } from 'node:fs/promises';
import { ensureConfigDir, getPinnedChatsPath } from '../utils/config-dir.js';

interface PinnedChat {
  id: string;
  displayName: string;
}

let pinnedChats: PinnedChat[] | null = null;

async function load(): Promise<PinnedChat[]> {
  if (pinnedChats !== null) return pinnedChats;
  try {
    const data = await readFile(getPinnedChatsPath(), 'utf-8');
    pinnedChats = JSON.parse(data);
    return pinnedChats!;
  } catch {
    pinnedChats = [];
    return pinnedChats;
  }
}

async function save(): Promise<void> {
  await ensureConfigDir();
  await writeFile(getPinnedChatsPath(), JSON.stringify(pinnedChats, null, 2), 'utf-8');
}

export async function getPinnedChatIds(): Promise<Set<string>> {
  const chats = await load();
  return new Set(chats.map((c) => c.id));
}

export async function isPinned(chatId: string): Promise<boolean> {
  const ids = await getPinnedChatIds();
  return ids.has(chatId);
}

export async function pinChat(chatId: string, displayName: string): Promise<void> {
  const chats = await load();
  if (chats.some((c) => c.id === chatId)) return;
  chats.push({ id: chatId, displayName });
  await save();
}

export async function unpinChat(chatId: string): Promise<void> {
  const chats = await load();
  pinnedChats = chats.filter((c) => c.id !== chatId);
  await save();
}
