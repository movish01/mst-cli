import chalk from 'chalk';
import { authService } from '../core/auth/auth-service.js';

export async function statusCommand(): Promise<void> {
  const user = await authService.getUserInfo();

  if (!user) {
    console.log(chalk.yellow('Not logged in.') + ' Run ' + chalk.cyan('msteams-cli login') + ' to authenticate.');
    return;
  }

  // Verify token is still valid
  const token = await authService.acquireTokenSilent();
  if (!token) {
    console.log(chalk.yellow('Session expired.') + ' Run ' + chalk.cyan('msteams-cli login') + ' to re-authenticate.');
    return;
  }

  console.log(chalk.green('✓') + ' Authenticated');
  console.log(`  Name:  ${chalk.bold(user.displayName)}`);
  console.log(`  Email: ${user.mail}`);
}
