import { Command } from 'commander'
import { envList, envAdd, envRemove } from '../env.js'

export const registerEnvCommand = (program: Command): void => {
  const envCmd = program.command('env').description('Manage Vite environment variables in .env')

  envCmd
    .command('list')
    .description('List environment variables in .env')
    .action(envList)

  envCmd
    .command('add <key> <value>')
    .description('Add or update an environment variable in .env')
    .action(envAdd)

  envCmd
    .command('remove <key>')
    .description('Remove an environment variable from .env')
    .action(envRemove)
}
