export interface ConversationItem {
  id: string;
  type: 'oneOnOne' | 'group' | 'meeting' | 'channel';
  displayName: string;
  lastMessagePreview: string | null;
  lastMessageTime: string | null;
  teamId?: string;
  channelId?: string;
}

export interface ChatMember {
  id: string;
  displayName: string;
  email: string;
}

export interface ChatMessage {
  id: string;
  messageType: string;
  createdDateTime: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  from: {
    user?: {
      id: string;
      displayName: string;
    };
    application?: {
      displayName: string;
    };
  } | null;
}

export interface Team {
  id: string;
  displayName: string;
  description: string | null;
}

export interface Channel {
  id: string;
  displayName: string;
  description: string | null;
  membershipType: string;
}
