import { runZenithAgentIntro } from '../../agent/intro.js'
import { createProject } from '../../generators/create.js'
import { setupFlags } from '../../ui/banner.js'

export const registerCreateCommand = (program) => {
  program
    .argument('[name]', 'project name or . for current directory')
    .option('--tailwind', 'install tailwindcss + @tailwindcss/vite')
    .option('--axios', 'install axios')
    .option('--socket', 'install socket.io-client')
    .option('--toast', 'install react-hot-toast')
    .option('--icon', 'install react-icons')
    .option('--lucide', 'install lucide-react')
    .option('--router', 'install react-router-dom and create src/router')
    .option('--qr', 'install react-qr-code')
    .option('--webcam', 'install react-webcam')
    .option('--printer', 'install react-to-print')
    .option('--env', 'create a .env file with Vite environment variables')
    .option('--watch', 'add frontend API watch client for react watch')
    .option('--ui', 'configure setup in a local browser wizard')
    .action(async (targetName, options) => {
      const rawArgs = process.argv.slice(2)
      const hasFlags = setupFlags.some((flag) => options[flag])

      if (!targetName && !hasFlags && rawArgs.length === 0) {
        const res = await runZenithAgentIntro()
        if (res && res.action === 'create') {
          await createProject(res.projName, {})
        }
        return
      }

      await createProject(targetName, options)
    })
}
