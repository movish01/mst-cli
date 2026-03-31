import chalk from 'chalk';

export function mainPrompt(): string {
  return chalk.cyan('mst') + chalk.gray('> ');
}

export function chatPrompt(name: string): string {
  const short = name.length > 15 ? name.slice(0, 15) + '…' : name;
  return chalk.cyan('mst') + chalk.gray(':') + chalk.green(short) + chalk.gray('> ');
}
