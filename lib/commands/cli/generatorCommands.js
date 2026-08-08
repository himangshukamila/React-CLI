import chalk from 'chalk'
import { configureFontAssets, configureImageAssets } from '../../generators/assets.js'
import { configureFormBoilerplate } from '../../generators/form.js'
import { configureLoaderBoilerplate } from '../../generators/loader.js'
import { configurePrinterBoilerplate } from '../../generators/printer.js'
import { makeFile } from '../../generators/make.js'
import { configureApiMethods, configureWebSocket, configureButton } from '../../shared.js'

export const registerGeneratorCommands = (program) => {
  program
    .command('set [target]')
    .description('Configure font assets, image constants, API client methods, or WebSocket service')
    .option('--font', 'Scan public/fonts and configure @font-face and Tailwind fonts in src/index.css')
    .option('--image', 'Scan public/images and generate src/utils/images.js constants')
    .option('--ws', 'Generate src/services/webSocket.js with auto-reconnect and message handlers')
    .allowUnknownOption()
    .action(async (target, options) => {
      const rawArgs = process.argv.slice(3)
      const lowerTarget = (target || '').toLowerCase()
      const validApiMethods = ['get', 'post', 'put', 'delete', 'patch']
      const requestedMethods = rawArgs
        .map((a) => a.toLowerCase().replace(/^--?/, ''))
        .filter((a) => validApiMethods.includes(a))
      const hasAuthFlag = rawArgs.some((a) => a.toLowerCase().replace(/^--?/, '') === 'auth')

      if (lowerTarget === 'font' || options.font) {
        await configureFontAssets()
      } else if (lowerTarget === 'image' || options.image) {
        await configureImageAssets()
      } else if (lowerTarget === 'form' || options.form) {
        await configureFormBoilerplate(rawArgs)
      } else if (lowerTarget === 'loader' || options.loader) {
        await configureLoaderBoilerplate()
      } else if (lowerTarget === 'printer' || lowerTarget === 'print' || options.printer) {
        await configurePrinterBoilerplate()
      } else if (lowerTarget === 'button' || lowerTarget === 'btn' || options.button) {
        await configureButton()
      } else if (lowerTarget === 'ws' || lowerTarget === 'websocket' || options.ws) {
        await configureWebSocket()
      } else if (lowerTarget === 'api' || options.api || requestedMethods.length > 0 || hasAuthFlag) {
        const methodsToSet = requestedMethods.length > 0 ? requestedMethods : ['get', 'post']
        await configureApiMethods(methodsToSet, { auth: hasAuthFlag })
      } else {
        console.error(chalk.red('Error: Please specify what to set (e.g. zecron set api -get -post, zecron set button, or zecron set ws)'))
        process.exit(1)
      }
    })

  program
    .command('make [folder] [name] [subfolder]')
    .description('Create src components, pages, forms, loaders, printers, buttons, or folder structures')
    .allowUnknownOption()
    .action(async (folder, name, subfolder) => {
      const rawArgs = process.argv.slice(3)
      const lowerFolder = (folder || '').toLowerCase()
      if (lowerFolder === 'form') {
        await configureFormBoilerplate(rawArgs)
      } else if (lowerFolder === 'loader') {
        await configureLoaderBoilerplate()
      } else if (lowerFolder === 'printer' || lowerFolder === 'print') {
        await configurePrinterBoilerplate()
      } else if (lowerFolder === 'button' || lowerFolder === 'btn') {
        await configureButton()
      } else if (folder) {
        await makeFile(folder, name, subfolder)
      } else {
        console.error(chalk.red('Error: Please specify what to make (e.g. zecron make form, zecron make loader, zecron make printer, or zecron make components Button)'))
        process.exit(1)
      }
    })
}
