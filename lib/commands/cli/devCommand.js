import { runDevServer } from '../dev.js'

export const registerDevCommand = (program) => {
  program
    .command('run')
    .description('Run npm run dev with --host 0.0.0.0 enabled')
    .option('-p, --port <number>', 'server port number')
    .option('-f, --f', 'Open dev server in Firefox Developer Edition')
    .action((options) => runDevServer(options.port, options))
}
