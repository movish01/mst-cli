import chalk from 'chalk';
import { authService } from '../core/auth/auth-service.js';

export async function loginCommand(): Promise<void> {
  // Check if already authenticated
  const existing = await authService.acquireTokenSilent();
  if (existing) {
    const user = await authService.getUserInfo();
    console.log(chalk.green('✓') + ` Already logged in as ${chalk.bold(user?.displayName || user?.mail)}`);
    return;
  }

  console.log('Authenticating with Microsoft Teams...\n');
  console.log(chalk.gray('Opening browser for sign-in...'));

  try {
    const result = await authService.acquireTokenInteractive();
    const name = result.account?.name || result.account?.username || 'Unknown';
    console.log(`\n${chalk.green('✓')} Logged in as ${chalk.bold(name)}`);
  } catch (error) {
    // If interactive fails, fall back to device code
    console.log(chalk.yellow('\nBrowser auth failed, falling back to device code flow...\n'));

    try {
      const result = await authService.acquireTokenByDeviceCode((message, userCode, verificationUri) => {
        console.log(chalk.yellow('To sign in:'));
        console.log(`  1. Open ${chalk.cyan.underline(verificationUri)}`);
        console.log(`  2. Enter code: ${chalk.bold.white(userCode)}`);
        console.log(`\nWaiting for authentication...`);
      });

      const name = result.account?.name || result.account?.username || 'Unknown';
      console.log(`\n${chalk.green('✓')} Logged in as ${chalk.bold(name)}`);
    } catch (fallbackError) {
      console.error(chalk.red('Authentication failed:'), fallbackError instanceof Error ? fallbackError.message : fallbackError);
      process.exit(1);
    }
  }
}
