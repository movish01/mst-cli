import { getGraphClient } from './graph-client.js';
import type { Team, Channel, ChatMessage } from './types.js';

export async function getJoinedTeams(): Promise<Team[]> {
  const client = getGraphClient();
  const response = await client.api('/me/joinedTeams').get();
  return response.value as Team[];
}

export async function getTeamChannels(teamId: string): Promise<Channel[]> {
  const client = getGraphClient();
  const response = await client.api(`/teams/${teamId}/channels`).get();
  return response.value as Channel[];
}

export async function getChannelMessages(teamId: string, channelId: string, top = 20): Promise<ChatMessage[]> {
  const client = getGraphClient();

  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages`)
    .top(top)
    .orderby('createdDateTime desc')
    .get();

  return (response.value as ChatMessage[]).reverse();
}

export async function sendChannelMessage(teamId: string, channelId: string, content: string): Promise<ChatMessage> {
  const client = getGraphClient();

  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages`)
    .post({
      body: {
        content,
      },
    });

  return response as ChatMessage;
}
