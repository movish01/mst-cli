import { getGraphClient } from './graph-client.js';
import { htmlToText } from './html-to-text.js';
import type { ConversationItem, ChatMessage } from './types.js';
import { authService } from '../auth/auth-service.js';

export async function getChatList(): Promise<ConversationItem[]> {
  const client = getGraphClient();
  const currentUser = await authService.getUserInfo();

  const response = await client
    .api('/me/chats')
    .select('id,topic,chatType,lastUpdatedDateTime')
    .expand('members,lastMessagePreview')
    .orderby('lastUpdatedDateTime desc')
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

    chats.push({
      id: chat.id,
      type: chat.chatType || 'oneOnOne',
      displayName,
      lastMessagePreview,
      lastMessageTime,
    });
  }

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

export async function getNewChatMessages(chatId: string, since: string): Promise<ChatMessage[]> {
  const client = getGraphClient();

  const response = await client
    .api(`/me/chats/${chatId}/messages`)
    .filter(`lastModifiedDateTime gt ${since}`)
    .orderby('createdDateTime asc')
    .get();

  return response.value as ChatMessage[];
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
