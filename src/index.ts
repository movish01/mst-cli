import { Command } from 'commander';
import { startRepl } from './repl/repl.js';

const program = new Command();

program
  .name('mst-cli')
  .description('Interactive CLI chat client for Microsoft Teams')
  .version('0.1.0');

// If no subcommand is provided, launch the interactive REPL
program
  .command('interactive', { isDefault: true, hidden: true })
  .description('Open interactive REPL (default when no command given)')
  .action(async () => {
    await startRepl();
  });

// Auth commands
program
  .command('login')
  .description('Authenticate with Microsoft Teams via device code flow')
  .action(async () => {
    const { loginCommand } = await import('./cli/login.js');
    await loginCommand();
  });

program
  .command('status')
  .description('Show current authentication status')
  .action(async () => {
    const { statusCommand } = await import('./cli/status.js');
    await statusCommand();
  });

// Chat commands
program
  .command('chats')
  .description('List your chats')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { chatsCommand } = await import('./cli/chats.js');
    await chatsCommand(opts);
  });

program
  .command('messages <chatId>')
  .description('Read messages from a chat')
  .option('--limit <n>', 'Number of messages to fetch', '20')
  .option('--json', 'Output as JSON')
  .action(async (chatId, opts) => {
    const { messagesCommand } = await import('./cli/messages.js');
    await messagesCommand(chatId, opts);
  });

program
  .command('send <chatId> [message]')
  .description('Send a message to a chat')
  .option('--to <name>', 'Find chat by person name (fuzzy match)')
  .option('--json', 'Output as JSON')
  .action(async (chatId, message, opts) => {
    const { sendCommand } = await import('./cli/send.js');
    await sendCommand(chatId, message, opts);
  });

// Teams commands
program
  .command('teams')
  .description('List your teams')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { teamsCommand } = await import('./cli/teams.js');
    await teamsCommand(opts);
  });

program
  .command('channels <teamId>')
  .description('List channels in a team')
  .option('--json', 'Output as JSON')
  .action(async (teamId, opts) => {
    const { channelsCommand } = await import('./cli/channels.js');
    await channelsCommand(teamId, opts);
  });

program
  .command('send-channel <teamId> <channelId> [message]')
  .description('Send a message to a team channel')
  .option('--json', 'Output as JSON')
  .action(async (teamId, channelId, message, opts) => {
    const { sendChannelCommand } = await import('./cli/send-channel.js');
    await sendChannelCommand(teamId, channelId, message, opts);
  });

program.parse();
