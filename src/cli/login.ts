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

  try {
    const result = await authService.acquireTokenByDeviceCode((message, userCode, verificationUri) => {
      console.log(chalk.yellow('To sign in:'));
      console.log(`  1. Open ${chalk.cyan.underline(verificationUri)}`);
      console.log(`  2. Enter code: ${chalk.bold.white(userCode)}`);
      console.log(`\nWaiting for authentication...`);
    });

    const name = result.account?.name || result.account?.username || 'Unknown';
    console.log(`\n${chalk.green('✓')} Logged in as ${chalk.bold(name)}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancelled')) {
      console.log(chalk.red('Authentication cancelled.'));
    } else {
      console.error(chalk.red('Authentication failed:'), error instanceof Error ? error.message : error);
    }
    process.exit(1);
  }
}
