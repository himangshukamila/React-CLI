import { Command } from 'commander'
import { registerAgentCommand } from './agentCommand.js'
import { registerInfoCommands } from './infoCommands.js'
import { registerDevCommand } from './devCommand.js'
import { registerEnvCommand } from './envCommand.js'
import { registerGeneratorCommands } from './generatorCommands.js'
import { registerGitCommand } from './gitCommand.js'
import { registerCreateCommand } from './createCommand.js'

export const registerAllCommands = (program: Command): void => {
  registerAgentCommand(program)
  registerInfoCommands(program)
  registerDevCommand(program)
  registerEnvCommand(program)
  registerGeneratorCommands(program)
  registerGitCommand(program)
  registerCreateCommand(program)
}
