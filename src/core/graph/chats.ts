import { getGraphClient } from './graph-client.js';
import { htmlToText } from './html-to-text.js';
import type { ConversationItem, ChatMessage } from './types.js';
import { authService } from '../auth/auth-service.js';

export async function findChatByName(name: string): Promise<ConversationItem[]> {
  const client = getGraphClient();
  const currentUser = await authService.getUserInfo();

  // Search for users in the org directory
  const userResponse = await client
    .api('/users')
    .header('ConsistencyLevel', 'eventual')
    .search(`"displayName:${name}"`)
    .select('id,displayName')
    .top(5)
    .get();

  const results: ConversationItem[] = [];

  for (const person of userResponse.value) {
    // Try to find or create a 1:1 chat with this person
    try {
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
              'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${person.id}')`,
            },
          ],
        });

      results.push({
        id: chatResponse.id,
        type: 'oneOnOne',
        displayName: person.displayName || name,
        lastMessagePreview: null,
        lastMessageTime: null,
      });
    } catch {
      // If we can't create/get the chat, still show the person as a result
      // with their user ID so user knows they were found
      results.push({
        id: person.id,
        type: 'oneOnOne',
        displayName: person.displayName || name,
        lastMessagePreview: null,
        lastMessageTime: null,
      });
    }
  }

  return results;
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
