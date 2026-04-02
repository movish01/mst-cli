import { getGraphClient } from './graph-client.js';
import { htmlToText } from './html-to-text.js';
import type { ConversationItem, ChatMessage } from './types.js';
import { authService } from '../auth/auth-service.js';

export async function findChatByName(name: string): Promise<ConversationItem[]> {
  const client = getGraphClient();
  const currentUser = await authService.getUserInfo();

  // First try searching the org directory
  let users: any[] = [];
  try {
    const searchResponse = await client
      .api('/users')
      .header('ConsistencyLevel', 'eventual')
      .search(`"displayName:${name}"`)
      .select('id,displayName')
      .top(5)
      .get();
    users = searchResponse.value;
  } catch {
    try {
      const filterResponse = await client
        .api('/users')
        .filter(`startswith(displayName,'${name}')`)
        .select('id,displayName')
        .top(5)
        .get();
      users = filterResponse.value;
    } catch {
      // Directory access blocked
    }
  }

  const results: ConversationItem[] = [];

  // Return users as results without creating chats
  // Chat will be created only when user selects one (via getOrCreateChat)
  for (const person of users) {
    if (person.id === currentUser?.id) continue;
    results.push({
      id: `user:${person.id}`,
      type: 'oneOnOne',
      displayName: person.displayName || name,
      lastMessagePreview: null,
      lastMessageTime: null,
    });
  }

  // If directory search found nothing, fall back to searching existing chats by member name
  if (results.length === 0) {
    const allChats = await getChatList();
    const Fuse = (await import('fuse.js')).default;
    const fuse = new Fuse(allChats, { keys: ['displayName'], threshold: 0.4 });
    const matched = fuse.search(name).map((r) => r.item);
    return matched;
  }

  return results;
}

export async function getOrCreateChat(conversation: ConversationItem): Promise<ConversationItem> {
  // If ID starts with "user:", it's a person from directory search — create chat on demand
  if (!conversation.id.startsWith('user:')) return conversation;

  const userId = conversation.id.slice(5);
  const client = getGraphClient();
  const currentUser = await authService.getUserInfo();

  const chatResponse = await client
    .api('/chats')
    .post({
      chatType: 'oneOnOne',
      members: [
        {
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${currentUser?.id}')`,
        },
        {
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${userId}')`,
        },
      ],
    });

  return {
    ...conversation,
    id: chatResponse.id,
  };
}

export async function getChatList(): Promise<ConversationItem[]> {
  const client = getGraphClient();
  const currentUser = await authService.getUserInfo();

  const response = await client
    .api('/me/chats')
    .select('id,topic,chatType,lastUpdatedDateTime,viewpoint')
    .expand('members,lastMessagePreview')
    .top(50)
    .get();

  const chats: ConversationItem[] = [];

  for (const chat of response.value) {
    let displayName: string;

    if (chat.topic) {
      displayName = chat.topic;
    } else if (chat.chatType === 'oneOnOne' && chat.members) {
      // For 1:1 chats, show the other person's name
      const otherMember = chat.members.find(
        (m: any) => m.userId !== currentUser?.id
      );
      displayName = otherMember?.displayName || 'Unknown';
    } else if (chat.members) {
      // For group chats without topic, join member names
      const names = chat.members
        .filter((m: any) => m.userId !== currentUser?.id)
        .map((m: any) => m.displayName || 'Unknown')
        .slice(0, 3);
      displayName = names.join(', ');
      if (chat.members.length > 4) {
        displayName += ` +${chat.members.length - 4}`;
      }
    } else {
      displayName = 'Chat';
    }

    const preview = chat.lastMessagePreview;
    let lastMessagePreview: string | null = null;
    let lastMessageTime: string | null = null;

    if (preview) {
      lastMessagePreview = preview.body?.content
        ? htmlToText(preview.body.content)
        : null;
      lastMessageTime = preview.createdDateTime || chat.lastUpdatedDateTime;
    } else {
      lastMessageTime = chat.lastUpdatedDateTime;
    }

    // Skip hidden/muted chats
    if (chat.viewpoint?.isHidden) continue;

    // Skip meeting chats with no real messages (just invites)
    if (chat.chatType === 'meeting' && !lastMessagePreview) continue;

    // Determine unread status from viewpoint
    let unreadCount = 0;
    if (chat.viewpoint?.lastMessageReadDateTime && lastMessageTime) {
      const readTime = new Date(chat.viewpoint.lastMessageReadDateTime).getTime();
      const msgTime = new Date(lastMessageTime).getTime();
      if (msgTime > readTime) unreadCount = 1;
    }

    chats.push({
      id: chat.id,
      type: chat.chatType || 'oneOnOne',
      displayName,
      lastMessagePreview,
      lastMessageTime,
      unreadCount,
    });
  }

  // Sort by most recent first (client-side, since Graph doesn't support orderby on this endpoint)
  chats.sort((a, b) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });

  return chats;
}

export async function getChatMessages(chatId: string, top = 20): Promise<ChatMessage[]> {
  const client = getGraphClient();

  const response = await client
    .api(`/me/chats/${chatId}/messages`)
    .top(top)
    .orderby('createdDateTime desc')
    .get();

  return (response.value as ChatMessage[]).reverse();
}

export async function getLatestChatMessages(chatId: string, top = 5): Promise<ChatMessage[]> {
  const client = getGraphClient();

  const response = await client
    .api(`/me/chats/${chatId}/messages`)
    .top(top)
    .get();

  return (response.value as ChatMessage[]).reverse();
}

export async function sendChatMessage(chatId: string, content: string): Promise<ChatMessage> {
  const client = getGraphClient();

  const response = await client
    .api(`/chats/${chatId}/messages`)
    .post({
      body: {
        content,
      },
    });

  return response as ChatMessage;
}

export async function markChatAsRead(chatId: string): Promise<void> {
  const client = getGraphClient();
  try {
    await client
      .api(`/me/chats/${chatId}/markChatReadForUser`)
      .post({
        user: { '@odata.type': 'microsoft.graph.teamworkUserIdentity' },
      });
  } catch {
    // markChatReadForUser may not be available — silently ignore
  }
}

export async function getOlderMessages(
  chatId: string,
  beforeDateTime: string,
  top = 20,
): Promise<ChatMessage[]> {
  const client = getGraphClient();

  const response = await client
    .api(`/me/chats/${chatId}/messages`)
    .filter(`createdDateTime lt ${beforeDateTime}`)
    .top(top)
    .orderby('createdDateTime desc')
    .get();

  return (response.value as ChatMessage[]).reverse();
}

export async function getUnreadChats(): Promise<ConversationItem[]> {
  const chats = await getChatList();
  return chats.filter((c) => c.unreadCount && c.unreadCount > 0);
}
