import type { ChatSession } from './chat-session.js';

let _activeChatSession: ChatSession | null = null;

export function getActiveChatSession(): ChatSession | null {
  return _activeChatSession;
}

export function setActiveChatSession(session: ChatSession | null): void {
  _activeChatSession = session;
}
