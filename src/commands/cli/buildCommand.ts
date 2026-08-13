import { Command } from 'commander'
import { runBuild, runPreview } from '../build.js'

export const registerBuildCommand = (program: Command): void => {
  program
    .command('build [action]')
    .description('Run production build (npm run build) and optionally launch preview (build open)')
    .option('-o, --open', 'Launch preview server after successful build')
    .action((action: string | undefined, options: { open?: boolean }) => runBuild(action, options))

  program
    .command('open')
    .alias('preview')
    .description('Launch production preview server without rebuilding (npm run preview)')
    .action(() => runPreview())
}
