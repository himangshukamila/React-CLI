import { Command } from 'commander'
import { printCommandReference } from '../../ui/banner.js'
import { runAudit } from '../audit.js'
import { checkUpdates } from '../updates.js'

export const registerInfoCommands = (program: Command): void => {
  program
    .command('list')
    .description('Show available CLI commands')
    .option('-c, --commands', 'list commands and their purpose')
    .action(printCommandReference)

  program
    .command('audit')
    .description('Audit project dependencies for security vulnerabilities')
    .action(runAudit)

  program
    .command('update')
    .description('Show outdated dependencies')
    .action(checkUpdates)
}

