#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { printCommandReference, setupFlags } from '../lib/ui/banner.js'
import { runZenithAgentIntro } from '../lib/agent/intro.js'
import { watchFrontendLogs } from '../lib/commands/watch.js'
import { doctor } from '../lib/commands/doctor.js'
import { runAudit } from '../lib/commands/audit.js'
import { checkUpdates } from '../lib/commands/updates.js'
import { runDevServer } from '../lib/commands/dev.js'
import { configureFontAssets, configureImageAssets, createAssetFolders } from '../lib/generators/assets.js'
import { configureFormBoilerplate } from '../lib/generators/form.js'
import { configureLoaderBoilerplate } from '../lib/generators/loader.js'
import { configurePrinterBoilerplate } from '../lib/generators/printer.js'
import { makeFile } from '../lib/generators/make.js'
import { gitPushWrapper } from '../lib/commands/git.js'
import { createProject } from '../lib/generators/create.js'

process.on('SIGINT', () => {
  console.log(chalk.hex('#94A3B8')('\nOperation cancelled 👋\n'))
  process.exit(0)
})

const program = new Command()

program
  .name('react')
  .description('Scaffold a Vite + React project')

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
  .command('run')
  .description('Run npm run dev with --host 0.0.0.0 enabled')
  .option('-p, --port <number>', 'server port number')
  .action((options) => runDevServer(options.port))

program
  .command('asset')
  .description('Create public images and fonts folders')
  .action(createAssetFolders)

program
  .command('set [target] [fields...]')
  .alias('env')
  .option('--font', 'Scan public/fonts and configure @font-face and Tailwind fonts in src/index.css')
  .option('--image', 'Scan public/images and generate src/utils/images.js constants')
  .option('--form', 'Generate a styled React Form component with field icons and state')
  .option('--loader', 'Generate a responsive Loader component with default text="Loading..."')
  .option('--printer', 'Generate a Printer page component with socket print-image queue')
  .allowUnknownOption()
  .action(async (target, fields, options) => {
    const rawArgs = process.argv.slice(3)
    if (target === 'form' || options.form || rawArgs.some(a => a.toLowerCase().includes('form'))) {
      await configureFormBoilerplate(rawArgs)
    } else if (target === 'loader' || options.loader || rawArgs.some(a => a.toLowerCase().includes('loader'))) {
      await configureLoaderBoilerplate()
    } else if (target === 'printer' || target === 'print' || options.printer || rawArgs.some(a => a.toLowerCase().includes('print'))) {
      await configurePrinterBoilerplate()
    } else if (target === 'font' || options.font) {
      await configureFontAssets()
    } else if (target === 'image' || options.image) {
      await configureImageAssets()
    } else {
      console.error(chalk.red('Error: Please specify what to set (e.g. set form, set loader, set printer, --font, or --image)'))
      process.exit(1)
    }
  })

program
  .command('form [fields...]')
  .description('Generate a styled React Form component with field icons and state')
  .allowUnknownOption()
  .action(async () => {
    const rawArgs = process.argv.slice(3)
    await configureFormBoilerplate(rawArgs)
  })

program
  .command('make [folder] [name] [subfolder]')
  .description('Create src folder structures or boilerplate files')
  .action(async (folder, name, subfolder) => {
    if (!folder) {
      console.error(chalk.red('Error: Please specify target folder (e.g. react make components Button or react make f components/ui)'))
      process.exit(1)
    }
    await makeFile(folder, name, subfolder)
  })

program
  .command('push')
  .description('Initialize Git and push the current workspace to a remote repository')
  .option('--git <url>', 'Git remote repository URL (origin)')
  .option('--github [arg]', 'Git remote repository URL or subsequent push commit message')
  .option('-m, --message <message>', 'Git commit message')
  .action(gitPushWrapper)

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
    const hasFlags = setupFlags.some(flag => options[flag])

    if (!targetName && !hasFlags && rawArgs.length === 0) {
      const res = await runZenithAgentIntro()
      if (res && res.action === 'create') {
        await createProject(res.projName, {})
      }
      return
    }

    await createProject(targetName, options)
  })

;(async () => {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`))
    process.exit(1)
  }
})()
