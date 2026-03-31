import { PublicClientApplication, type DeviceCodeRequest, type AuthenticationResult, type AccountInfo } from '@azure/msal-node';
import { MSAL_CONFIG, SCOPES } from './config.js';
import { tokenCachePlugin } from './token-cache-plugin.js';

class AuthService {
  private pca: PublicClientApplication;

  constructor() {
    this.pca = new PublicClientApplication({
      auth: MSAL_CONFIG.auth,
      cache: {
        cachePlugin: tokenCachePlugin,
      },
    });
  }

  private async getAccount(): Promise<AccountInfo | null> {
    const cache = this.pca.getTokenCache();
    const accounts = await cache.getAllAccounts();
    return accounts.length > 0 ? accounts[0] : null;
  }

  async acquireTokenSilent(): Promise<AuthenticationResult | null> {
    const account = await this.getAccount();
    if (!account) return null;

    try {
      return await this.pca.acquireTokenSilent({
        scopes: SCOPES,
        account,
      });
    } catch {
      return null;
    }
  }

  async acquireTokenByDeviceCode(
    onUserCode: (message: string, userCode: string, verificationUri: string) => void
  ): Promise<AuthenticationResult> {
    const request: DeviceCodeRequest = {
      scopes: SCOPES,
      deviceCodeCallback: (response) => {
        onUserCode(response.message, response.userCode, response.verificationUri);
      },
    };
    const result = await this.pca.acquireTokenByDeviceCode(request);
    if (!result) {
      throw new Error('Device code authentication returned no result.');
    }
    return result;
  }

  async getAccessToken(): Promise<string> {
    const silent = await this.acquireTokenSilent();
    if (silent?.accessToken) {
      return silent.accessToken;
    }
    throw new Error('Not authenticated. Run "mst-cli login" first.');
  }

  async isAuthenticated(): Promise<boolean> {
    const account = await this.getAccount();
    return account !== null;
  }

  async getUserInfo(): Promise<{ displayName: string; id: string; mail: string } | null> {
    const account = await this.getAccount();
    if (!account) return null;
    return {
      displayName: account.name || account.username,
      id: account.localAccountId,
      mail: account.username,
    };
  }

  async logout(): Promise<void> {
    const cache = this.pca.getTokenCache();
    const accounts = await cache.getAllAccounts();
    for (const account of accounts) {
      await cache.removeAccount(account);
    }
  }
}

export const authService = new AuthService();
