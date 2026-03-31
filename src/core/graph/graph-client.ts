import { Client } from '@microsoft/microsoft-graph-client';
import { authService } from '../auth/auth-service.js';

let client: Client | null = null;

export function getGraphClient(): Client {
  if (!client) {
    client = Client.init({
      authProvider: async (done) => {
        try {
          const token = await authService.getAccessToken();
          done(null, token);
        } catch (error) {
          done(error as Error, null);
        }
      },
    });
  }
  return client;
}
