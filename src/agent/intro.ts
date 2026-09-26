import chalk from 'chalk'
import { printBanner, section, printCommandReference } from '../ui/banner.js'
import { configureLoaderBoilerplate } from '../generators/loader.js'
import { configurePrinterBoilerplate } from '../generators/printer.js'
import { configureFormBoilerplate } from '../generators/form.js'
import { configureButton } from '../generators/button.js'
import { configureWrapper } from '../generators/wrapper.js'
import { gitPushWrapper } from '../commands/git.js'

export interface AgentIntroResult {
  action: 'create'
  projName: string
}

export const runZecronAgentIntro = async (): Promise<AgentIntroResult | void> => {
  const { text, isCancel } = await import('@clack/prompts')
  printBanner()

  section('zecron agent cli', 'interactive prompt mode')

  console.log([
    `  ${chalk.hex('#38BDF8').bold('✦ Quick Guide & Commands:')}`,
    `     ${chalk.hex('#00E5FF').bold('• <project-name>')}   ${chalk.white('Create a new React + Vite project')} ${chalk.hex('#94A3B8')('(e.g. my-app or .)')}`,
    `     ${chalk.hex('#00E5FF').bold('• /help')}            ${chalk.white('Check all available CLI commands & usage')}`,
    `     ${chalk.hex('#00E5FF').bold('• /set loader')}      ${chalk.white('Generate responsive backdrop-blur Loader.jsx')}`,
    `     ${chalk.hex('#00E5FF').bold('• /set printer')}     ${chalk.white('Generate Printer.jsx page with socket print queue')}`,
    `     ${chalk.hex('#00E5FF').bold('• /set form')}        ${chalk.white('Generate styled Form.jsx component')}`,
    `     ${chalk.hex('#00E5FF').bold('• /set button')}      ${chalk.white('Generate reusable Button.jsx component')}`,
    `     ${chalk.hex('#00E5FF').bold('• /set wrapper')}     ${chalk.white('Generate fullscreen Wrapper.jsx component')}`,
    `     ${chalk.hex('#00E5FF').bold('• /push')}            ${chalk.white('Stage, commit, and push updates to Git remote')}`,
    `     ${chalk.hex('#00E5FF').bold('• /exit')}            ${chalk.white('Exit Zecron CLI (or press Ctrl+C)')}`,
  ].join('\n'))

  while (true) {
    console.log('')
    const input = await text({
      message: 'zecron agent ❯',
      placeholder: 'e.g. my-app, /help, /set loader, /exit',
    })

    if (isCancel(input) || !input || typeof input !== 'string' || input.trim() === '/exit' || input.trim() === 'exit' || input.trim() === 'quit') {
      console.log(chalk.hex('#94A3B8')('\nGoodbye!\n'))
      process.exit(0)
    }

    const trimmed = input.trim()
    const lower = trimmed.toLowerCase()

    if (lower === '/help' || lower === 'help' || lower === '/list' || lower === 'list') {
      printCommandReference()
    } else if (lower === '/set loader' || lower === 'set loader' || lower === 'loader') {
      await configureLoaderBoilerplate()
    } else if (lower === '/set printer' || lower === 'set printer' || lower === 'printer' || lower === 'print') {
      await configurePrinterBoilerplate()
    } else if (lower.startsWith('/set form') || lower.startsWith('set form') || lower === 'form') {
      const parts = trimmed.split(' ').slice(2)
      await configureFormBoilerplate(parts)
    } else if (lower === '/set button' || lower === 'set button' || lower === 'button') {
      await configureButton()
    } else if (lower === '/set wrapper' || lower === 'set wrapper' || lower === 'wrapper') {
      await configureWrapper()
    } else if (lower.startsWith('/push') || lower === 'push') {
      const gitMsg = await text({
        message: 'Enter commit message or remote repository URL:',
        placeholder: 'update project files',
        defaultValue: 'update project files',
      })
      if (isCancel(gitMsg) || typeof gitMsg !== 'string') process.exit(0)
      await gitPushWrapper({ github: gitMsg })
    } else {
      const projName = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
      return { action: 'create', projName }
    }
  }
}
