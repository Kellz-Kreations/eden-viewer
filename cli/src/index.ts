import { Command } from 'commander';
import { createDelegateCommand } from './commands/delegate';

const program = new Command();

// Register commands
program.addCommand(createDelegateCommand());

export default program;