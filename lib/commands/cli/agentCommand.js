import { runZenithAgentIntro } from '../../agent/intro.js'
import { createProject } from '../../generators/create.js'

export const registerAgentCommand = (program) => {
  program
    .command('zenith')
    .description('Launch Zenith Interactive Agent Welcome Hub & Prompt Mode')
    .action(async () => {
      const res = await runZenithAgentIntro()
      if (res && res.action === 'create') {
        await createProject(res.projName, {})
      }
    })
}
