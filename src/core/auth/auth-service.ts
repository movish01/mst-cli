import { PublicClientApplication, type DeviceCodeRequest, type AuthenticationResult, type AccountInfo } from '@azure/msal-node';
import { exec } from 'node:child_process';
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

  async acquireTokenInteractive(): Promise<AuthenticationResult> {
    const result = await this.pca.acquireTokenInteractive({
      scopes: SCOPES,
      openBrowser: async (url: string) => {
        // Open the URL in the default browser
        const cmd = process.platform === 'darwin' ? 'open'
          : process.platform === 'win32' ? 'start'
          : 'xdg-open';
        exec(`${cmd} "${url}"`);
      },
      successTemplate: '<h1>Authentication successful!</h1><p>You can close this window and return to the terminal.</p>',
      errorTemplate: '<h1>Authentication failed</h1><p>Error: {{error}}</p>',
    });
    return result;
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
    throw new Error('Not authenticated. Run "msteams-cli login" first.');
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
