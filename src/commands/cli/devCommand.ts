import { Command } from 'commander'
import { runDevServer } from '../dev.js'

export const registerDevCommand = (program: Command): void => {
  program
    .command('run')
    .description('Run npm run dev with --host 0.0.0.0 enabled')
    .option('-p, --port <number>', 'server port number')
    .option('-f, --f', 'Open dev server in Firefox Developer Edition')
    .action((options: { port?: string | number; f?: boolean }) => runDevServer(options.port, options))
}
