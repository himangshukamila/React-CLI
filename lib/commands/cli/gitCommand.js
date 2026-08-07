import { gitPushWrapper } from '../git.js'

export const registerGitCommand = (program) => {
  program
    .command('push')
    .description('Initialize Git and push the current workspace to a remote repository')
    .option('--git <url>', 'Git remote repository URL (origin)')
    .option('--github [arg]', 'Git remote repository URL or subsequent push commit message')
    .option('-m, --message <message>', 'Git commit message')
    .action(gitPushWrapper)
}
