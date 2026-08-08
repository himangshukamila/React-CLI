import { runZecronAgentIntro } from '../../agent/intro.js'
import { createProject } from '../../generators/create.js'

export const registerAgentCommand = (program) => {
  program
    .command('zecron')
    .description('Launch Zecron Interactive Agent Welcome Hub & Prompt Mode')
    .action(async () => {
      const res = await runZecronAgentIntro()
      if (res && res.action === 'create') {
        await createProject(res.projName, {})
      }
    })
}
