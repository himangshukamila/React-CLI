import { Command } from 'commander'
import { watchFrontendLogs } from '../watch.js'
import { printCommandReference } from '../../ui/banner.js'
import { doctor } from '../doctor.js'
import { runAudit } from '../audit.js'
import { checkUpdates } from '../updates.js'
import { createAssetFolders } from '../../generators/assets.js'

export const registerInfoCommands = (program: Command): void => {
  program
    .command('watch')
    .description('Print frontend API response logs from a React app')
    .action(watchFrontendLogs)

  program
    .command('list')
    .description('Show available CLI commands')
    .option('-c, --commands', 'list commands and their purpose')
    .action(printCommandReference)

  program
    .command('doctor')
    .description('Check the current React project setup')
    .action(doctor)

  program
    .command('audit')
    .description('Audit project dependencies for security vulnerabilities')
    .action(runAudit)

  program
    .command('update')
    .description('Show outdated dependencies')
    .action(checkUpdates)

  program
    .command('asset')
    .description('Create public images and fonts folders')
    .action(createAssetFolders)
}
