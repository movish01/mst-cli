import * as readline from 'node:readline';
import chalk from 'chalk';
import { authService } from '../core/auth/auth-service.js';
import { mainPrompt } from './prompt.js';
import { completer } from './completer.js';
import { getCommands } from './commands.js';
import { getActiveChatSession, setActiveChatSession } from './session-state.js';

function createRl(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: mainPrompt(),
    completer,
    terminal: true,
  });
}

export async function startRepl(): Promise<void> {
  // Authenticate first
  console.log(chalk.cyan('mst-cli') + ' — Microsoft Teams interactive shell\n');

  const silent = await authService.acquireTokenSilent();
  if (silent) {
    const user = await authService.getUserInfo();
    console.log(chalk.green('✓') + ` Logged in as ${chalk.bold(user?.displayName || user?.mail)}\n`);
  } else {
    console.log('Not logged in. Opening browser for sign-in...\n');
    try {
      const result = await authService.acquireTokenInteractive();
      const name = result.account?.name || result.account?.username || 'Unknown';
      console.log(`${chalk.green('✓')} Logged in as ${chalk.bold(name)}\n`);
    } catch {
      console.log(chalk.yellow('Browser auth failed, trying device code flow...\n'));
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
  }

  console.log('Type ' + chalk.cyan('help') + ' for available commands, ' + chalk.cyan('exit') + ' to quit.\n');

  const commands = getCommands();
  let sigintCount = 0;

  // Main REPL loop — recreate readline after each command
  // because @inquirer/prompts takes over stdin and breaks readline
  const loop = async (): Promise<void> => {
    const rl = createRl();
    rl.prompt();

    return new Promise<void>((resolve) => {
      rl.on('line', async (line) => {
        sigintCount = 0;

        // If in a chat session, forward input to the chat handler
        const chatSession = getActiveChatSession();
        if (chatSession) {
          await chatSession.handleLine(line);
          return;
        }

        const trimmed = line.trim();

        if (!trimmed) {
          rl.prompt();
          return;
        }

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

        // Close readline before running command (inquirer needs raw stdin)
        rl.close();

        try {
          await handler(args, rl);
        } catch (error) {
          if (error instanceof Error && error.message.includes('Not authenticated')) {
            console.error(chalk.red('Session expired. Please restart mst-cli to re-authenticate.'));
          } else {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
          }
        }

        // Command done — resolve to restart the loop with a fresh readline
        resolve();
      });

      rl.on('SIGINT', () => {
        const chatSession = getActiveChatSession();
        if (chatSession) {
          chatSession.cleanup();
          setActiveChatSession(null);
          console.log('\n');
          // Close and restart loop to get fresh readline
          rl.close();
          resolve();
          return;
        }

        sigintCount++;
        if (sigintCount >= 2) {
          console.log(chalk.gray('\nGoodbye!'));
          rl.close();
          process.exit(0);
        }
        console.log(chalk.gray('\n(Press Ctrl+C again to exit)'));
        rl.prompt();
      });
    });
  };

  // Infinite loop: each iteration creates a fresh readline
  while (true) {
    await loop();
  }
}
