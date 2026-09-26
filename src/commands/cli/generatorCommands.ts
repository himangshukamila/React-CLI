import { Command } from 'commander'
import chalk from 'chalk'
import { configureFontAssets } from '../../generators/assets.js'
import { configureFormBoilerplate } from '../../generators/form.js'
import { configureLoaderBoilerplate } from '../../generators/loader.js'
import { configurePrinterBoilerplate } from '../../generators/printer.js'
import { configureBonjourBoilerplate } from '../../generators/bonjour.js'
import { configureButton } from '../../generators/button.js'
import { configureWrapper } from '../../generators/wrapper.js'
import { configureApiMethods, configureWebSocket, configureSocket } from '../../shared.js'

export const registerGeneratorCommands = (program: Command): void => {
  program
    .command('set [target]')
    .description('Configure font assets, API client methods, WebSocket service, or Bonjour service')
    .option('--font', 'Scan public/fonts and configure @font-face and Tailwind fonts in src/index.css')
    .option('--ws', 'Generate src/services/webSocket.js with auto-reconnect and message handlers')
    .option('--socket', 'Generate src/services/socket.js with socket.io-client connection')
    .option('--bonjour', 'Wire 4b-react-mdns network discovery and scaffold the discovery page')
    .option('--api', 'Generate src/services/api.js with the requested request methods')
    .option('--get', 'Include GET method in API service')
    .option('--post', 'Include POST method in API service')
    .option('--put', 'Include PUT method in API service')
    .option('--del', 'Include DELETE method in API service')
    .option('--delete', 'Include DELETE method in API service')
    .option('--patch', 'Include PATCH method in API service')
    .option('--auth', 'Include Authorization Bearer token interceptor')
    .option('--form', 'Generate src/components/Form.jsx from the requested fields')
    .option('--loader', 'Generate src/components/Loader.jsx backdrop loader')
    .option('--printer', 'Generate src/pages/Printer.jsx socket print queue')
    .option('--button', 'Generate src/components/Button.jsx with variants and sizes')
    .option('--wrapper', 'Generate src/components/Wrapper.jsx fullscreen background wrapper')
    .allowUnknownOption()
    .action(async (target: string | undefined, options: Record<string, any>) => {
      const rawArgs = process.argv.slice(3)
      const lowerTarget = (target || '').toLowerCase()
      const validApiMethods = ['get', 'post', 'put', 'delete', 'del', 'patch']
      const requestedMethods = rawArgs
        .map((a) => a.toLowerCase().replace(/^--?/, ''))
        .filter((a) => validApiMethods.includes(a))
      const hasAuthFlag = rawArgs.some((a) => a.toLowerCase().replace(/^--?/, '') === 'auth')

      const targets: Record<string, string> = {
        font: 'font',
        form: 'form',
        loader: 'loader',
        printer: 'printer',
        print: 'printer',
        bonjour: 'bonjour',
        button: 'button',
        btn: 'button',
        wrapper: 'wrapper',
        ws: 'ws',
        websocket: 'ws',
        socket: 'socket',
        api: 'api',
      }

      // the root command declares some of the same flags (--printer, --bonjour)
      // and commander hands those to the root, so fall back to reading argv.
      // an explicit target always wins.
      const flagged = Object.keys(targets).find(
        (name) =>
          Boolean(options[name]) ||
          rawArgs.some((a) => a.toLowerCase().replace(/^--?/, '') === name)
      )
      const kind = targets[lowerTarget] || (flagged ? targets[flagged] : '')

      if (kind === 'font') {
        await configureFontAssets()
      } else if (kind === 'form') {
        await configureFormBoilerplate(rawArgs)
      } else if (kind === 'loader') {
        await configureLoaderBoilerplate()
      } else if (kind === 'printer') {
        await configurePrinterBoilerplate()
      } else if (kind === 'bonjour') {
        await configureBonjourBoilerplate()
      } else if (kind === 'button') {
        await configureButton()
      } else if (kind === 'wrapper') {
        await configureWrapper()
      } else if (kind === 'ws') {
        await configureWebSocket()
      } else if (kind === 'socket') {
        await configureSocket(process.cwd())
      } else if (kind === 'api' || requestedMethods.length > 0 || hasAuthFlag) {
        const methodsToSet = requestedMethods.length > 0 ? requestedMethods : ['get', 'post']
        await configureApiMethods(methodsToSet, { auth: hasAuthFlag })
      } else {
        console.error(chalk.red('Error: Please specify what to set (e.g. zecron set api -get -post, zecron set button, zecron set wrapper, zecron set ws, zecron set socket, or zecron set bonjour)'))
        process.exit(1)
      }
    })

  program
    .command('make [target]')
    .description('Generate src components, pages, forms, loaders, printers, buttons, or wrappers')
    .allowUnknownOption()
    .action(async (target: string | undefined) => {
      const rawArgs = process.argv.slice(3)
      const lowerTarget = (target || '').toLowerCase()
      if (lowerTarget === 'form') {
        await configureFormBoilerplate(rawArgs)
      } else if (lowerTarget === 'loader') {
        await configureLoaderBoilerplate()
      } else if (lowerTarget === 'printer' || lowerTarget === 'print') {
        await configurePrinterBoilerplate()
      } else if (lowerTarget === 'button' || lowerTarget === 'btn') {
        await configureButton()
      } else if (lowerTarget === 'wrapper') {
        await configureWrapper()
      } else if (lowerTarget === 'socket') {
        await configureSocket(process.cwd())
      } else {
        console.error(chalk.red('Error: Please specify what to make (e.g. zecron make form, zecron make loader, zecron make printer, zecron make button, or zecron make wrapper)'))
        process.exit(1)
      }
    })
}
