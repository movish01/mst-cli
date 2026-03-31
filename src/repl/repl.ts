import * as readline from 'node:readline';
import chalk from 'chalk';
import { authService } from '../core/auth/auth-service.js';
import { mainPrompt } from './prompt.js';
import { completer } from './completer.js';
import { getCommands } from './commands.js';

export async function startRepl(): Promise<void> {
  // Authenticate first
  console.log(chalk.cyan('mst-cli') + ' — Microsoft Teams interactive shell\n');

  const silent = await authService.acquireTokenSilent();
  if (silent) {
    const user = await authService.getUserInfo();
    console.log(chalk.green('✓') + ` Logged in as ${chalk.bold(user?.displayName || user?.mail)}\n`);
  } else {
    console.log('Not logged in. Starting device code flow...\n');
    try {
      const result = await authService.acquireTokenByDeviceCode((message, userCode, verificationUri) => {
        console.log(chalk.yellow('To sign in:'));
        console.log(`  1. Open ${chalk.cyan.underline(verificationUri)}`);
        console.log(`  2. Enter code: ${chalk.bold.white(userCode)}\n`);
        console.log('Waiting for authentication...');
      });
      const name = result.account?.name || result.account?.username || 'Unknown';
      console.log(`\n${chalk.green('✓')} Logged in as ${chalk.bold(name)}\n`);
    } catch (error) {
      console.error(chalk.red('Authentication failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  console.log('Type ' + chalk.cyan('help') + ' for available commands, ' + chalk.cyan('exit') + ' to quit.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: mainPrompt(),
    completer,
    terminal: true,
  });

  const commands = getCommands();

  rl.prompt();

  let sigintCount = 0;

  rl.on('line', async (line) => {
    sigintCount = 0;
    const trimmed = line.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Parse command and args
    const spaceIdx = trimmed.indexOf(' ');
    const cmd = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.slice(0, spaceIdx).toLowerCase();
    const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

    if (cmd === 'exit' || cmd === 'quit') {
      console.log(chalk.gray('Goodbye!'));
      rl.close();
      process.exit(0);
    }

    const handler = commands.get(cmd);
    if (!handler) {
      console.log(chalk.yellow(`Unknown command: ${cmd}`) + '. Type ' + chalk.cyan('help') + ' for available commands.');
      rl.prompt();
      return;
    }

    try {
      await handler(args, rl);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        console.error(chalk.red('Session expired. Please restart mst-cli to re-authenticate.'));
      } else {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      }
    }

    // Restore main prompt after command completes
    rl.setPrompt(mainPrompt());
    rl.prompt();
  });

  rl.on('SIGINT', () => {
    sigintCount++;
    if (sigintCount >= 2) {
      console.log(chalk.gray('\nGoodbye!'));
      rl.close();
      process.exit(0);
    }
    console.log(chalk.gray('\n(Press Ctrl+C again to exit)'));
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
