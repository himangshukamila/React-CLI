#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import readline from 'node:readline'
import { intro, outro, cancel } from '@clack/prompts'
import chalk from 'chalk'
import { Command } from 'commander'
import { execa } from 'execa'
import fs from 'fs-extra'
import {
  configureEnv,
  copyFile,
  createPackageHandlers,
  ensureDir,
  pathExists,
  readDir,
  readFile,
  removePath,
  rootDir,
  runCommand,
  writeFile,
  cliIconContent,
} from '../lib/shared.js'

const projectNameRegex = /^[a-zA-Z0-9_-]+$|^\.$/
const fileNameRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/
const envKeyRegex = /^VITE_[A-Z][A-Z0-9_]*$/
const watchPortStart = 4570
const setupUiPortStart = 3002
const maxWatchBodyBytes = 128 * 1024
const defaultFlagFolders = ['components', 'pages', 'hooks', 'utils']
const packageFlags = ['tailwind', 'axios', 'socket', 'toast', 'icon', 'lucide', 'router', 'qr', 'webcam', 'printer']
const featureFlags = ['env', 'watch']
const setupFlags = [...packageFlags, ...featureFlags]
const folderFlags = featureFlags
const accent = chalk.hex('#D97757')
const muted = chalk.gray
const strong = chalk.bold.white

const commandReference = [
  ['react <name>', 'Create a new Vite + React app'],
  ['react <name> --ui', 'Configure the app in a local browser setup wizard'],
  ['react .', 'Create the app in the current directory'],
  ['react <name> --tailwind --axios', 'Create an app without prompts using flags'],
  ['react list -c', 'Show all available commands and their purpose'],
  ['react run', 'Run npm run dev with --host enabled'],
  ['react run --port 3000', 'Run the dev server on a specific port'],
  ['react update', 'Show outdated dependencies without upgrading'],
  ['react doctor', 'Check the current React project setup'],
  ['react env list', 'List Vite environment variables from .env'],
  ['react env add VITE_SERVER_URL http://localhost:3000', 'Add or update a VITE_ environment variable'],
  ['react env remove VITE_SERVER_URL', 'Remove a VITE_ environment variable'],
  ['react make f components/ui', 'Create a folder under src/'],
  ['react make components Button', 'Create a file inside an existing src folder'],
  ['react asset', 'Create public asset folders'],
  ['react watch', 'Print frontend fetch/XHR response logs'],
  ['react push --git <url>', 'Initialize Git and push workspace to remote repo'],
  ['react push -m <msg>', 'Push subsequent updates to remote repo'],
  ['react set --font', 'Scan public/fonts and configure @font-face and Tailwind fonts in src/index.css'],
  ['react set --image', 'Scan public/images and generate src/utils/images.js constants'],
  ['pkg axios', 'Install a package or alias in an existing project'],
  ['pkg --dev @types/node', 'Install a package as a dev dependency'],
]

const packageOptions = [
  { value: 'tailwind', label: 'Tailwind CSS', hint: 'style engine + Vite plugin' },
  { value: 'axios', label: 'Axios', hint: 'typed API client starter' },
  { value: 'socket', label: 'Socket.IO Client', hint: 'realtime websocket layer' },
  { value: 'toast', label: 'React Toastify', hint: 'toast helpers + container' },
  { value: 'router', label: 'React Router', hint: 'react-router-dom + src/router' },
  { value: 'qr', label: 'QR Code', hint: 'react-qr-code' },
  { value: 'webcam', label: 'Webcam', hint: 'react-webcam' },
  { value: 'printer', label: 'Print Helper', hint: 'react-to-print' },
  { value: 'icon', label: 'React Icons', hint: 'large icon library' },
  { value: 'lucide', label: 'Lucide React', hint: 'sharp SVG icon set' },
]

const folderOptions = [
  { value: "env", label: ".env", hint: "VITE_SERVER_URL boilerplate" },
  { value: "assets", label: "public/assets", hint: "create public/images and public/fonts" },

  {
    value: "components",
    label: "src/components",
    hint: "reusable interface pieces",
  },
  { value: "pages", label: "src/pages", hint: "route-level screens" },
  {
    value: "watch",
    label: "Frontend API Watch",
    hint: "adds src/anshh-watch for react watch",
  },
  {
    value: "services",
    label: "src/services",
    hint: "api clients · data fetchers",
  },
  { value: "hooks", label: "src/hooks", hint: "custom react hooks" },
  { value: "utils", label: "src/utils", hint: "helper functions" },
  { value: "store", label: "src/store", hint: "state management layer" },
  { value: "lib", label: "src/lib", hint: "third-party configuration" },
  { value: "types", label: "src/types", hint: "shared type contracts" },
];

const setupLaunchChoices = [
  { value: 'runDevServer', label: 'Run npm run dev after setup', hint: '--host 0.0.0.0' },
]

const section = (label, meta = '') => {
  const rule = muted('·'.repeat(54))
  console.log(`\n${accent(label.toUpperCase())} ${rule} ${muted(meta)}`)
}

const row = (label, value, hint = '') => {
  console.log(`${muted(label.padEnd(12))}${strong(value)} ${hint ? muted(` ${hint}`) : ''}`)
}

const printCommandReference = () => {
  section('commands', 'available actions')

  const commandWidth = Math.max(...commandReference.map(([command]) => command.length)) + 2
  commandReference.forEach(([command, purpose]) => {
    console.log(`${accent(command.padEnd(commandWidth))}${chalk.white(purpose)}`)
  })

  console.log(`\n${muted('alias')}    ${chalk.white('anshh can be used instead of react if you linked the personal alias.')}`)
}

const printBanner = () => {
//   const banner = [
//     '███╗   ███╗ █████╗ ██████╗ ███████╗    ██████╗ ██╗   ██╗',
//     '████╗ ████║██╔══██╗██╔══██╗██╔════╝    ██╔══██╗╚██╗ ██╔╝',
//     '██╔████╔██║███████║██║  ██║█████╗      ██████╔╝ ╚████╔╝ ',
//     '██║╚██╔╝██║██╔══██║██║  ██║██╔══╝      ██╔══██╗  ╚██╔╝  ',
//     '██║ ╚═╝ ██║██║  ██║██████╔╝███████╗    ██████╔╝   ██║   ',
//     '╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝    ╚═════╝    ╚═╝   ',
//     '',
//     ' █████╗ ███╗   ██╗███████╗██╗  ██╗██╗  ██╗',
//     '██╔══██╗████╗  ██║██╔════╝██║  ██║██║  ██║',
//     '███████║██╔██╗ ██║███████╗███████║███████║',
//     '██╔══██║██║╚██╗██║╚════██║██╔══██║██╔══██║',
//     '██║  ██║██║ ╚████║███████║██║  ██║██║  ██║',
//     '╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝',
  // ]
  
  const banner = [
    "╔══════════════════════════════════════════════════════════════════════════════════════════════╗",
    "║                                                                                              ║",
    "║                                                                                              ║",
    "║                                                                                              ║",
    "║         ██╗  ██╗   ██████╗         ██████╗   ███████╗   █████╗    ██████╗  ████████╗         ║",
    "║         ██║  ██║   ██╔══██╗        ██╔══██╗  ██╔════╝  ██╔══██╗  ██╔════╝  ╚══██╔══╝         ║",
    "║         ███████║   ██████╔╝        ██████╔╝  █████╗    ███████║  ██║          ██║            ║",
    "║         ╚════██║   ██╔══██╗        ██╔══██╗  ██╔══╝    ██╔══██║  ██║          ██║            ║",
    "║              ██║   ██████╔╝        ██║  ██║  ███████╗  ██║  ██║  ╚██████╗     ██║            ║",
    "║              ╚═╝   ╚═════╝         ╚═╝  ╚═╝  ╚══════╝  ╚═╝  ╚═╝   ╚═════╝     ╚═╝            ║",
    "║                                                                                              ║",
    "║                                                                                              ║",
    "║                                                                                              ║",
    "║                                         Crafted With a Little Help of AI & Designed by Anshh ║",
    "╚══════════════════════════════════════════════════════════════════════════════════════════════╝",
  ];

  console.log('')
  banner.forEach((line) => console.log(chalk.hex("#1dbbf5").bold(line)));
  console.log('')
}

const printControls = () => {
  const rule = chalk.hex('#6FA8DC')('═'.repeat(42))
  const key = (value) => chalk.bgHex('#6FA8DC').black.bold(` ${value} `)
  const action = (value) => chalk.whiteBright.bold(value)

  console.log(`\n${chalk.bold.hex('#FF8A5B')('CONTROLS')} ${rule}`)
  console.log(`${key('SPACE')} ${action('select')}   ${key('ENTER')} ${action('confirm')}   ${key('A')} ${action('toggle all')}`)
}

const renderSelectOption = ({ option, selected, active }) => {
  const cursor = active ? accent('› ') : '  '
  const box = selected ? accent('■') : muted('□')
  const diamond = selected ? strong('◆') : muted('◇')
  const label = selected ? strong(option.label) : muted(option.label)
  const hint = option.hint ? muted(`  (${option.hint})`) : ''

  return `${cursor}${box} ${diamond} ${label}${hint}`
}

const clearLines = (count) => {
  process.stdout.write(`\x1b[${count}A\x1b[J`)
}

const createProgress = (steps) => {
  let current = 0
  let renderedLines = 0
  let frame = 0
  let timer
  const width = 34
  const frames = ['◐', '◓', '◑', '◒']

  const render = () => {
    if (renderedLines > 0) clearLines(renderedLines)

    const pct = Math.round((current / steps.length) * 100)
    const filled = Math.round((current / steps.length) * width)
    const bar = `${accent('█'.repeat(filled))}${muted('·'.repeat(width - filled))}`
    const lines = steps.map((step, index) => {
      if (index < current) return `${chalk.green('✓')} ${strong(step.done)} ${muted(step.meta || '')}`
      if (index === current) return `${accent(frames[frame])} ${strong(step.active)} ${muted(step.meta || '')}`
      return `${muted('□')} ${muted(step.pending)}`
    })

    lines.push(`${bar} ${strong(`${pct}%`)}`)
    process.stdout.write(`${lines.join('\n')}\n`)
    renderedLines = lines.length
  }

  return {
    start() {
      section('install', 'running setup pipeline')
      render()
    },
    async step(task) {
      timer = setInterval(() => {
        frame = (frame + 1) % frames.length
        render()
      }, 120)

      try {
        await task()
      } finally {
        clearInterval(timer)
        timer = undefined
      }
      current += 1
      render()
    },
    done() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      if (current < steps.length) {
        current = steps.length
        render()
      }
    },
  }
}

const customMultiselect = ({ options, initialValues = [] }) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve(initialValues)
  }

  return new Promise((resolve) => {
    const selected = new Set(initialValues)
    let activeIndex = 0
    let renderedLines = 0

    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)

    const render = () => {
      if (renderedLines > 0) clearLines(renderedLines)

      const lines = options.map((option, index) => renderSelectOption({
        option,
        selected: selected.has(option.value),
        active: index === activeIndex,
      }))

      process.stdout.write(`${lines.join('\n')}\n`)
      renderedLines = lines.length
    }

    const done = () => {
      process.stdin.setRawMode(false)
      process.stdin.off('keypress', onKeypress)
      clearLines(renderedLines)

      const lines = options.map((option) => renderSelectOption({
        option,
        selected: selected.has(option.value),
        active: false,
      }))

      process.stdout.write(`${lines.join('\n')}\n`)
      resolve([...selected])
    }

    const onKeypress = (_, key) => {
      if (key?.name === 'c' && key.ctrl) {
        process.stdin.setRawMode(false)
        process.stdin.off('keypress', onKeypress)
        cancel('Operation cancelled')
        process.exit(1)
      }

      if (key?.name === 'up') {
        activeIndex = activeIndex === 0 ? options.length - 1 : activeIndex - 1
        render()
        return
      }

      if (key?.name === 'down') {
        activeIndex = activeIndex === options.length - 1 ? 0 : activeIndex + 1
        render()
        return
      }

      if (key?.name === 'space') {
        const value = options[activeIndex].value
        if (selected.has(value)) selected.delete(value)
        else selected.add(value)
        render()
        return
      }

      if (key?.name === 'a') {
        if (selected.size === options.length) selected.clear()
        else options.forEach((option) => selected.add(option.value))
        render()
        return
      }

      if (key?.name === 'return') {
        done()
      }
    }

    process.stdin.on('keypress', onKeypress)
    render()
  })
}

const customConfirm = ({ message, initialValue = true }) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    let value = initialValue
    let renderedLines = 0

    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)

    const render = () => {
      if (renderedLines > 0) clearLines(renderedLines)

      const yes = value ? accent('■ yes') : muted('□ yes')
      const no = value ? muted('□ no') : accent('■ no')
      const lines = [
        `${accent('›')} ${strong(message)}`,
        `  ${yes}   ${no}   ${muted('space toggle · y/n select · enter confirm')}`,
      ]

      process.stdout.write(`${lines.join('\n')}\n`)
      renderedLines = lines.length
    }

    const done = () => {
      process.stdin.setRawMode(false)
      process.stdin.off('keypress', onKeypress)
      clearLines(renderedLines)

      const answer = value ? accent('yes') : muted('no')
      process.stdout.write(`${accent('›')} ${strong(message)} ${answer}\n`)
      resolve(value)
    }

    const onKeypress = (input, key) => {
      if (key?.name === 'c' && key.ctrl) {
        process.stdin.setRawMode(false)
        process.stdin.off('keypress', onKeypress)
        cancel('Operation cancelled')
        process.exit(1)
      }

      const pressed = String(input || key?.name || '').toLowerCase()

      if (pressed === 'y' || key?.name === 'left' || key?.name === 'up') {
        value = true
        render()
        return
      }

      if (pressed === 'n' || key?.name === 'right' || key?.name === 'down') {
        value = false
        render()
        return
      }

      if (key?.name === 'space' || key?.name === 'tab') {
        value = !value
        render()
        return
      }

      if (key?.name === 'return') {
        done()
      }
    }

    process.stdin.on('keypress', onKeypress)
    render()
  })
}

const printCliHeader = ({ displayName, commandTarget }) => {
  console.log(`${strong('react-cli')} ${muted('1.0.0')}  ${muted('·')}  ${muted(`node ${process.versions.node}`)}  ${muted('·')}  ${muted(process.platform)}`)
  console.log(`${muted('type')} ${accent('help')} ${muted('to see commands, run')} ${accent(`react ${displayName}`)} ${muted('to begin.')}`)
  console.log('')
  console.log(`${accent('›')} ${muted(commandTarget === '.' ? process.cwd() : `~/${displayName}`)} ${strong('create')} ${strong(displayName)}`)
  console.log(`${strong('react-cli')} ${muted('1.0.0')}  ${muted('scaffold a new app')}`)
}

const printConfigPreview = () => {
  section('config')
  row('template', 'React + Vite')
  row('language', 'JavaScript')
  row('styling', 'CSS Modules')
  row('router', 'Optional')
  row('testing', 'None')
  row('package mgr', 'npm')
}

const fail = (message) => {
  console.error(chalk.red(message))
  process.exit(1)
}

const validateProjectName = (name) => {
  if (!projectNameRegex.test(name) || name.includes('..') || name.includes('/')) {
    fail('Invalid project name')
  }
}

const hasSelectedFlags = (options) => setupFlags.some((flag) => options[flag])

const getSelectedFlagPackages = (options) => packageFlags.filter((flag) => options[flag])

const getSelectedFlagSetup = (options) => setupFlags.filter((flag) => options[flag])

const getSelectedFlagFolders = (options) => [...defaultFlagFolders, ...folderFlags.filter((flag) => options[flag])]

const runInteractivePrompts = async () => {
  printControls()

  section('modules', 'select packages and project features')
  const selectedPackages = await customMultiselect({
    options: packageOptions,
    initialValues: ['tailwind'],
  })

  section('structure', 'select optional src folders')
  const selectedFolders = await customMultiselect({
    options: folderOptions,
    initialValues: ['env', 'components', 'pages'],
  })

  const shouldRunDevServer = await askToRunDevServer()
  const selectedFolderNames = selectedFolders.filter((value) => !folderFlags.includes(value))
  const selectedSetup = [
    ...selectedPackages,
    ...selectedFolders.filter((value) => folderFlags.includes(value)),
  ]

  return {
    selectedPackages: selectedPackages.filter((value) => packageFlags.includes(value)),
    selectedSetup,
    selectedFolders: selectedFolderNames,
    shouldRunDevServer,
  }
}

const validateSelectionValues = (label, values, allowedValues) => {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`)

  const allowed = new Set(allowedValues)
  const clean = []

  values.forEach((value) => {
    if (typeof value !== 'string' || !allowed.has(value)) {
      throw new Error(`Invalid ${label} selection: ${String(value)}`)
    }

    if (!clean.includes(value)) clean.push(value)
  })

  return clean
}

const normalizeUiSelections = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid setup payload')
  }

  const selectedPackages = validateSelectionValues(
    'package',
    payload.packages || [],
    packageOptions.map((option) => option.value),
  )
  const selectedStructure = validateSelectionValues(
    'structure',
    payload.structure || [],
    folderOptions.map((option) => option.value),
  )
  const selectedLaunch = validateSelectionValues(
    'launch',
    payload.launch || [],
    setupLaunchChoices.map((option) => option.value),
  )
  const selectedFeatures = selectedStructure.filter((value) => folderFlags.includes(value))
  const selectedFolders = selectedStructure.filter((value) => !folderFlags.includes(value))

  const devServerPort = payload.devServerPort ? parseInt(payload.devServerPort, 10) : 5173
  if (isNaN(devServerPort) || devServerPort < 1 || devServerPort > 65535) {
    throw new Error('Invalid development server port (must be between 1 and 65535)')
  }

  const createdFiles = Array.isArray(payload.createdFiles) ? payload.createdFiles : []
  const validFolders = folderOptions.filter((o) => !folderFlags.includes(o.value)).map((o) => o.value)
  createdFiles.forEach((file) => {
    if (!file || typeof file !== 'object' || !file.name || !file.folder || !file.ext) {
      throw new Error('Invalid file entry in createdFiles')
    }
    if (!validFolders.includes(file.folder)) {
      throw new Error(`Invalid target folder for custom file: ${file.folder}`)
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(file.name)) {
      throw new Error(`Invalid custom file name format: ${file.name}`)
    }
    if (file.ext !== '.jsx' && file.ext !== '.js') {
      throw new Error(`Invalid custom file extension: ${file.ext}`)
    }
  })

  return {
    selectedPackages,
    selectedSetup: [...selectedPackages, ...selectedFeatures],
    selectedFolders,
    shouldRunDevServer: selectedLaunch.includes('runDevServer'),
    devServerPort,
    createdFiles,
  }
}

const createSetupUiHtml = async ({ displayName, token, submitUrl, timeLeftMs }) => {
  const template = await readFile(path.join(rootDir, 'templates', 'setup-ui', 'index.html'))
  const html = template
    .replaceAll('__PROJECT_NAME__', displayName)
    .replaceAll('__SESSION_TOKEN__', token)
    .replaceAll('__SUBMIT_URL__', submitUrl)
    .replaceAll('__TIME_LEFT_MS__', String(timeLeftMs))

  if (html.includes('__PROJECT_NAME__') || html.includes('__SESSION_TOKEN__') || html.includes('__SUBMIT_URL__') || html.includes('__TIME_LEFT_MS__')) {
    throw new Error('Setup UI template render failed: unreplaced placeholder found')
  }

  return html
}

const readSetupUiStyle = () => readFile(path.join(rootDir, 'templates', 'setup-ui', 'style.css'))

const createSelectedFolders = async (projectPath, selectedFolders) => {
  for (const folder of selectedFolders) {
    if (folder === 'assets') {
      await ensureDir(path.join(projectPath, 'public', 'images'))
      await ensureDir(path.join(projectPath, 'public', 'fonts'))
    } else {
      const folderPath = path.join(projectPath, 'src', folder)
      await ensureDir(folderPath)
    }
  }
}

const createCustomFiles = async (projectPath, createdFiles) => {
  for (const file of createdFiles) {
    const folderPath = path.join(projectPath, 'src', file.folder)
    await ensureDir(folderPath)
    const filePath = path.join(folderPath, `${file.name}${file.ext}`)

    if (file.ext === '.jsx') {
      let jsxContent;
      if (file.folder === 'components' && (file.name === 'Wrapper' || file.name === 'wrapper')) {
        jsxContent = `const Wrapper = ({ children }) => {
  return (
    <>
      <div className="h-screen w-screen relative">
        {children}
      </div>
    </>
  );
};

export default WrapperComponent;
`
      } else if (file.folder === 'components' && (file.name === 'Loader' || file.name === 'loader')) {
        jsxContent = `const Loader = () => {
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
      </div>
    </>
  );
};

export default Loader;
`
      } else {
        jsxContent = `const ${file.name} = () => {
  return (
    <>
      <div>${file.name}</div>
    </>
  );
};

export default ${file.name};
`
      }
      await writeFile(filePath, jsxContent)
    } else if (file.ext === '.js') {
      const jsContent = `const ${file.name} = () => {
  // Logic goes here
}

export default ${file.name}
`
      await writeFile(filePath, jsContent)
    }
  }
}

const configureFrontendWatch = async (projectPath) => {
  await copyFile(
    path.join(rootDir, 'templates', 'base', 'src', 'anshh-watch', 'client.js'),
    path.join(projectPath, 'src', 'anshh-watch', 'client.js'),
  )

  const mainPath = path.join(projectPath, 'src', 'main.jsx')
  const content = await readFile(mainPath)
  if (content.includes("./anshh-watch/client.js") || content.includes("'./anshh-watch/client.js'")) return

  const watchImport = `
if (import.meta.env.DEV) {
  import('./anshh-watch/client.js')
}
`
  const appImport = "import App from './App.jsx'\n"
  if (content.includes(appImport)) {
    await writeFile(mainPath, content.replace(appImport, `${appImport}${watchImport}`))
    return
  }

  await writeFile(mainPath, `${watchImport}\n${content}`)
}

const applyBaseTemplates = async (projectPath, selectedSetup = []) => {
  await copyFile(
    path.join(rootDir, 'templates', 'base', 'src', 'App.jsx'),
    path.join(projectPath, 'src', 'App.jsx'),
  )
  await copyFile(
    path.join(rootDir, 'templates', 'base', 'src', 'main.jsx'),
    path.join(projectPath, 'src', 'main.jsx'),
  )

  if (selectedSetup.includes('watch')) {
    await configureFrontendWatch(projectPath)
  }
}

const deleteViteBoilerplate = async (projectPath) => {
  const targets = [
    path.join(projectPath, 'src', 'App.css'),
    path.join(projectPath, 'src', 'index.css'),
    path.join(projectPath, 'src', 'assets'),
    path.join(projectPath, 'public', 'vite.svg'),
    path.join(projectPath, 'src', 'App.jsx'),
  ]

  for (const target of targets) {
    await removePath(target)
  }

  // Ensure public folder exists and write custom brand favicon files
  await ensureDir(path.join(projectPath, 'public'))
  await writeFile(path.join(projectPath, 'public', 'favicon.svg'), cliIconContent)
  await writeFile(path.join(projectPath, 'public', 'vite.svg'), cliIconContent)
}

const configureIndexHtml = async (projectPath, projectName) => {
  const indexHtmlPath = path.join(projectPath, 'index.html')
  if (await pathExists(indexHtmlPath)) {
    let content = await readFile(indexHtmlPath)
    
    // Replace default icon link with custom brand favicon using robust regex
    const iconRegex = /<link\s+[^>]*href=["']\/?vite\.svg["'][^>]*\/?>/i
    if (iconRegex.test(content)) {
      content = content.replace(iconRegex, '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    } else {
      content = content.replace(/(<link\s+[^>]*href=["'])\/?vite\.svg(["'][^>]*\/?>)/i, '$1/favicon.svg$2')
    }
    
    // Customize page title using robust regex matching any title content
    const formattedTitle = projectName.charAt(0).toUpperCase() + projectName.slice(1)
    content = content.replace(
      /<title>[^<]*<\/title>/i,
      `<title>${formattedTitle}</title>`
    )
    
    await writeFile(indexHtmlPath, content)
  }
}

const postInstallHandlers = createPackageHandlers({ installPackages: true })

const collectProjectEntries = (selectedFolders, selectedSetup) => {
  const srcEntries = ['main.jsx', 'App.jsx']
  if (selectedSetup.includes('tailwind')) srcEntries.push('index.css')
  srcEntries.push(...selectedFolders.map((folder) => `${folder}/`))

  const rootEntries = ['public/', 'index.html', 'vite.config.js']
  if (selectedSetup.includes('env')) rootEntries.push('.env')
  rootEntries.push('package.json')

  return { srcEntries, rootEntries }
}

const printProjectPreview = ({ displayName, selectedFolders, selectedSetup }) => {
  const { srcEntries, rootEntries } = collectProjectEntries(selectedFolders, selectedSetup)

  section('project')
  console.log(accent(`${displayName}/`))
  console.log(`${muted('├─')} ${accent('src/')}`)
  if (selectedSetup.includes('watch')) srcEntries.push('anshh-watch/')
  srcEntries.forEach((entry, index) => {
    const branch = index === srcEntries.length - 1 ? '└─' : '├─'
    const color = entry.endsWith('/') ? accent : strong
    console.log(`${muted('│  ')}${muted(branch)} ${color(entry)}`)
  })

  rootEntries.forEach((entry, index) => {
    const branch = index === rootEntries.length - 1 ? '└─' : '├─'
    const color = entry.endsWith('/') ? accent : strong
    console.log(`${muted(branch)} ${color(entry)}`)
  })
}

const createSetupSteps = (selectedPackages, selectedSetup) => {
  const steps = [
    {
      pending: 'scaffold',
      active: 'scaffolding',
      done: 'scaffolded',
      meta: 'vite react template',
    },
    {
      pending: 'templates',
      active: 'writing templates',
      done: 'templates',
      meta: 'App.jsx · main.jsx',
    },
    {
      pending: 'dependencies',
      active: 'installing dependencies',
      done: 'dependencies',
      meta: 'npm install',
    },
  ]

  selectedPackages.forEach((packageName) => {
    steps.push({
      pending: packageName,
      active: `installing ${packageName}`,
      done: packageName,
      meta: 'package ready',
    })
  })

  if (selectedSetup.includes('env')) {
    steps.push({
      pending: '.env',
      active: 'writing .env',
      done: '.env',
      meta: 'vite urls',
    })
  }

  steps.push({
    pending: 'ready',
    active: 'finalizing',
    done: 'ready',
    meta: 'project complete',
  })

  return steps
}

const askToRunDevServer = async () => {
  section('launch', 'start development server')
  return customConfirm({
    message: 'run npm run dev now?',
    initialValue: true,
  })
}

const printSummary = ({ displayName, selectedFolders, selectedSetup, commandTarget }) => {
  const folders = selectedFolders.length > 0 ? selectedFolders.join(', ') : 'none'
  const setup = selectedSetup.length > 0 ? selectedSetup.join(', ') : 'none'

  outro([
    `${chalk.hex('#D97757')('READY')} ${chalk.gray('project scaffold complete')}`,
    `${chalk.gray('project')}  ${chalk.white(displayName)}`,
    `${chalk.gray('modules')}  ${chalk.white(setup)}`,
    `${chalk.gray('folders')}  ${chalk.white(folders)}`,
    `${chalk.gray('launch')}   ${chalk.white(`cd ${commandTarget} && npm run dev`)}`,
  ].join('\n'))
}

const pass = (message, hint = '') => {
  console.log(`${chalk.green('✓')} ${strong(message)} ${hint ? muted(hint) : ''}`)
}

const warn = (message, hint = '') => {
  console.log(`${chalk.yellow('!')} ${strong(message)} ${hint ? muted(hint) : ''}`)
}

const readCurrentPackageJson = async () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  if (!(await pathExists(packageJsonPath))) {
    throw new Error('Not inside a React project. Run this from your app folder.')
  }

  try {
    return JSON.parse(await readFile(packageJsonPath))
  } catch {
    throw new Error('Could not read package.json. Make sure it is valid JSON.')
  }
}

const getDependencies = (packageJson) => ({
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
})

const assertDevScript = (packageJson) => {
  if (!packageJson.scripts?.dev) {
    throw new Error('No dev script found in package.json')
  }
}

const validatePort = (port) => {
  if (port === undefined) return undefined

  const parsed = Number(port)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('Port must be a number between 1 and 65535')
  }

  return String(parsed)
}

const runDevServer = async (options = {}) => {
  try {
    const packageJson = await readCurrentPackageJson()
    assertDevScript(packageJson)

    const args = ['run', 'dev', '--', '--host', '0.0.0.0']
    const port = validatePort(options.port)
    if (port) args.push('--port', port)

    section('run', port ? `npm run dev -- --host 0.0.0.0 --port ${port}` : 'npm run dev -- --host 0.0.0.0')
    await runCommand(
      'npm',
      args,
      { cwd: process.cwd(), stdio: 'inherit' },
      'Failed to run development server',
    )
  } catch (error) {
    fail(error.message)
  }
}

const checkUpdates = async () => {
  try {
    await readCurrentPackageJson()
    section('update', 'read-only dependency check')

    let result
    try {
      result = await execa('npm', ['outdated', '--json'], {
        cwd: process.cwd(),
        reject: false,
      })
    } catch (error) {
      throw new Error(`Could not check outdated packages: ${error.shortMessage || error.message}`)
    }

    if (![0, 1].includes(result.exitCode)) {
      throw new Error(result.stderr || 'npm outdated failed')
    }

    const raw = result.stdout.trim()
    const outdated = raw ? JSON.parse(raw) : {}
    const entries = Object.entries(outdated)

    if (entries.length === 0) {
      pass('All dependencies are up to date')
      console.log(muted('No packages were installed or changed.'))
      return
    }

    const nameWidth = Math.max('package'.length, ...entries.map(([name]) => name.length)) + 2
    const currentWidth = Math.max('current'.length, ...entries.map(([, info]) => String(info.current || '-').length)) + 2
    const wantedWidth = Math.max('wanted'.length, ...entries.map(([, info]) => String(info.wanted || '-').length)) + 2

    console.log(
      `${muted('package'.padEnd(nameWidth))}${muted('current'.padEnd(currentWidth))}${muted('wanted'.padEnd(wantedWidth))}${muted('latest')}`,
    )

    entries.forEach(([name, info]) => {
      const current = String(info.current || '-')
      const wanted = String(info.wanted || '-')
      const latest = String(info.latest || '-')
      console.log(
        `${accent(name.padEnd(nameWidth))}${chalk.white(current.padEnd(currentWidth))}${chalk.white(wanted.padEnd(wantedWidth))}${chalk.green(latest)}`,
      )
    })

    console.log(`\n${muted('No packages were installed or changed.')}`)
  } catch (error) {
    fail(error.message)
  }
}

const readTextIfExists = async (targetPath) => {
  if (!(await pathExists(targetPath))) return ''
  return readFile(targetPath)
}

const doctor = async () => {
  try {
    section('doctor', 'project health check')

    console.log(`${muted('node')}     ${strong(process.version)}`)

    try {
      const npmVersion = await runCommand('npm', ['--version'], { stdio: 'pipe' }, 'Could not read npm version')
      console.log(`${muted('npm')}      ${strong(npmVersion.stdout)}`)
    } catch (error) {
      warn('npm check failed', error.message)
    }

    const packageJsonPath = path.join(process.cwd(), 'package.json')
    if (!(await pathExists(packageJsonPath))) {
      warn('package.json missing', 'run this inside a React project')
      return
    }

    pass('package.json found')

    const packageJson = await readCurrentPackageJson()
    const dependencies = getDependencies(packageJson)

    if (dependencies.react) pass('React installed', dependencies.react)
    else warn('React missing')

    if (dependencies.vite) pass('Vite installed', dependencies.vite)
    else warn('Vite missing')

    const mainPath = path.join(process.cwd(), 'src', 'main.jsx')
    const appPath = path.join(process.cwd(), 'src', 'App.jsx')
    const viteConfigPath = path.join(process.cwd(), 'vite.config.js')
    const envPath = path.join(process.cwd(), '.env')

    if (await pathExists(mainPath)) pass('src/main.jsx found')
    else warn('src/main.jsx missing')

    if (await pathExists(appPath)) pass('src/App.jsx found')
    else warn('src/App.jsx missing')

    if (await pathExists(viteConfigPath)) pass('vite.config.js found')
    else warn('vite.config.js missing')

    if (await pathExists(envPath)) {
      pass('.env found')
      const envContent = await readFile(envPath)
      ;['VITE_SERVER_URL'].forEach((key) => {
        if (envContent.includes(`${key}=`)) pass(`${key} set`)
        else warn(`${key} missing`)
      })
    } else {
      warn('.env missing', 'run react-setup env add VITE_SERVER_URL http://localhost:3000')
    }

    if (dependencies.tailwindcss || dependencies['@tailwindcss/vite']) {
      const viteConfig = await readTextIfExists(viteConfigPath)
      const indexCss = await readTextIfExists(path.join(process.cwd(), 'src', 'index.css'))

      if (dependencies.tailwindcss) pass('Tailwind installed', dependencies.tailwindcss)
      else warn('tailwindcss missing')

      if (dependencies['@tailwindcss/vite']) pass('@tailwindcss/vite installed', dependencies['@tailwindcss/vite'])
      else warn('@tailwindcss/vite missing')

      if (viteConfig.includes('@tailwindcss/vite') && viteConfig.includes('tailwindcss()')) {
        pass('Tailwind Vite plugin configured')
      } else {
        warn('Tailwind Vite plugin not configured')
      }

      if (indexCss.includes('@import "tailwindcss"') || indexCss.includes("@import 'tailwindcss'")) {
        pass('Tailwind CSS import found')
      } else {
        warn('Tailwind CSS import missing')
      }
    }
  } catch (error) {
    fail(error.message)
  }
}

const parseEnvFile = (content) => {
  const lines = content ? content.split('\n') : []
  const entries = new Map()

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return
    const index = trimmed.indexOf('=')
    entries.set(trimmed.slice(0, index), trimmed.slice(index + 1))
  })

  return entries
}

const writeEnvEntries = async (entries) => {
  const content = [...entries.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  await writeFile(path.join(process.cwd(), '.env'), `${content}${content ? '\n' : ''}`)
}

const validateEnvKey = (key) => {
  if (!envKeyRegex.test(key)) {
    throw new Error('Env key must start with VITE_ and use uppercase letters, numbers, and underscores')
  }
}

const envList = async () => {
  try {
    const envPath = path.join(process.cwd(), '.env')
    section('env', 'list variables')

    if (!(await pathExists(envPath))) {
      warn('.env missing')
      return
    }

    const entries = parseEnvFile(await readFile(envPath))
    if (entries.size === 0) {
      warn('no variables found')
      return
    }

    entries.forEach((value, key) => {
      console.log(`${accent(key.padEnd(22))}${chalk.white(value)}`)
    })
  } catch (error) {
    fail(error.message)
  }
}

const envAdd = async (key, value) => {
  try {
    validateEnvKey(key)

    if (typeof value !== 'string' || value.includes('\n') || value.includes('\r')) {
      throw new Error('Env value must be a single line')
    }

    const envPath = path.join(process.cwd(), '.env')
    const entries = parseEnvFile(await readTextIfExists(envPath))
    const existed = entries.has(key)
    entries.set(key, value)
    await writeEnvEntries(entries)
    pass(existed ? `updated ${key}` : `added ${key}`)
  } catch (error) {
    fail(error.message)
  }
}

const envRemove = async (key) => {
  try {
    validateEnvKey(key)

    const envPath = path.join(process.cwd(), '.env')
    const entries = parseEnvFile(await readTextIfExists(envPath))

    if (!entries.has(key)) {
      warn(`${key} not found`)
      return
    }

    entries.delete(key)
    await writeEnvEntries(entries)
    pass(`removed ${key}`)
  } catch (error) {
    fail(error.message)
  }
}

const toPascalCase = (value) => value
  .split(/[-_\s]+/)
  .filter(Boolean)
  .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
  .join('')

const toCamelCase = (value) => {
  const pascal = toPascalCase(value)
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`
}

const validatePathSegments = (segments) => {
  segments.forEach((segment) => {
    if (!fileNameRegex.test(segment) || segment.includes('..')) {
      throw new Error('Invalid file or folder name')
    }
  })
}

const parseFolderTarget = (folderName) => {
  const folderParts = folderName.split(/[\\/]/).filter(Boolean)

  if (folderParts.length === 0 || folderName.includes('..')) {
    throw new Error('Invalid folder name')
  }

  validatePathSegments(folderParts)
  return folderParts
}

const parseMakeTarget = (folderName, name, subfolder) => {
  const baseFolderParts = folderName.split(/[\\/]/).filter(Boolean)
  const nameParts = name.split(/[\\/]/).filter(Boolean)
  const subfolderParts = subfolder ? subfolder.split(/[\\/]/).filter(Boolean) : []
  const allParts = [...baseFolderParts, ...subfolderParts, ...nameParts]

  if (
    baseFolderParts.length === 0
    || nameParts.length === 0
    || folderName.includes('..')
    || name.includes('..')
    || (subfolder && subfolder.includes('..'))
  ) {
    throw new Error('Invalid file or folder name')
  }

  validatePathSegments(allParts)

  return {
    baseFolders: baseFolderParts,
    folders: [...subfolderParts, ...nameParts.slice(0, -1)],
    baseName: nameParts.at(-1),
  }
}

const makeTemplates = {
  component: (name) => `const ${name} = () => {
  return (
    <section className="p-4">
      <h2 className="text-xl font-semibold text-slate-950">${name}</h2>
    </section>
  )
}

export default ${name}
`,
  page: (name) => `const ${name} = () => {
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-slate-950">${name}</h1>
    </main>
  )
}

export default ${name}
`,
  hook: (name) => `import { useState } from 'react'

export const ${name} = (initialValue = null) => {
  const [value, setValue] = useState(initialValue)

  return { value, setValue }
}
`,
  service: (name) => `const ${name} = {
  async get(url, options = {}) {
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new Error(\`Request failed with status \${response.status}\`)
    }

    return response.json()
  },
}

export default ${name}
`,
  default: (name) => `export const ${name} = () => {
  return null
}
`,
}

const makeConfig = {
  component: { ext: 'jsx', format: toPascalCase, template: 'component' },
  page: { ext: 'jsx', format: toPascalCase, template: 'page' },
  hook: {
    ext: 'js',
    format: (name) => {
      const formatted = toPascalCase(name.replace(/^use/i, ''))
      return `use${formatted}`
    },
    template: 'hook',
  },
  service: { ext: 'js', format: toCamelCase, template: 'service' },
  default: { ext: 'js', format: toCamelCase, template: 'default' },
}

const makeFolderKinds = {
  component: 'component',
  components: 'component',
  page: 'page',
  pages: 'page',
  hook: 'hook',
  hooks: 'hook',
  service: 'service',
  services: 'service',
}

const ensureExistingFolder = async (folderPath) => {
  const relativePath = path.relative(process.cwd(), folderPath)

  if (!(await pathExists(folderPath))) {
    throw new Error(`Folder does not exist: ${relativePath}. Create this folder first.`)
  }

  try {
    await readDir(folderPath)
  } catch {
    throw new Error(`Path is not a folder: ${relativePath}`)
  }
}

const makeFolder = async (folderName) => {
  const folderParts = parseFolderTarget(folderName)
  const targetPath = path.join(process.cwd(), 'src', ...folderParts)
  const relativePath = path.relative(process.cwd(), targetPath)

  if (await pathExists(targetPath)) {
    warn(`folder already exists: ${relativePath}`)
    return
  }

  await ensureDir(targetPath)
  pass(`created ${relativePath}`)
}

const makeFile = async (folderName, name, subfolder) => {
  try {
    if (folderName === 'f' || folderName === 'folder') {
      await makeFolder(name)
      return
    }

    const target = parseMakeTarget(folderName, name, subfolder)
    const kind = makeFolderKinds[target.baseFolders.at(-1).toLowerCase()] || 'default'
    const config = makeConfig[kind]
    const exportName = config.format(target.baseName)
    const fileName = `${exportName}.${config.ext}`
    const targetDir = path.join(process.cwd(), 'src', ...target.baseFolders, ...target.folders)
    const targetPath = path.join(targetDir, fileName)

    await ensureExistingFolder(targetDir)

    if (await pathExists(targetPath)) {
      throw new Error(`File already exists: ${targetPath}`)
    }

    await writeFile(targetPath, makeTemplates[config.template](exportName))
    pass(`created ${path.relative(process.cwd(), targetPath)}`)
  } catch (error) {
    fail(error.message)
  }
}

const createAssetFolders = async () => {
  try {
    await readCurrentPackageJson()

    const folders = [
      path.join(process.cwd(), 'public', 'assets', 'images'),
      path.join(process.cwd(), 'public', 'assets', 'icons'),
      path.join(process.cwd(), 'public', 'assets', 'fonts'),
    ]

    section('asset', 'create asset folders')

    for (const folderPath of folders) {
      const relativePath = path.relative(process.cwd(), folderPath)
      if (await pathExists(folderPath)) {
        warn(`folder already exists: ${relativePath}`)
        continue
      }

      await ensureDir(folderPath)
      pass(`created ${relativePath}`)
    }
  } catch (error) {
    fail(error.message)
  }
}

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const getRelativeUrlPath = (filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const publicIndex = normalizedPath.toLowerCase().lastIndexOf('/public/')
  if (publicIndex !== -1) {
    return '/' + normalizedPath.slice(publicIndex + 8)
  }
  return '/' + path.basename(filePath)
}

const getFontFiles = async (dir, filesList = []) => {
  const entries = await readDir(dir).catch(() => [])
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      await getFontFiles(fullPath, filesList)
    } else {
      const ext = path.extname(entry).toLowerCase()
      if (['.ttf', '.woff', '.woff2', '.otf'].includes(ext)) {
        filesList.push(fullPath)
      }
    }
  }
  return filesList
}

const getFontFamily = (filePath) => {
  const parentDir = path.basename(path.dirname(filePath))
  let rawName = parentDir
  if (parentDir.toLowerCase() === 'fonts') {
    rawName = path.basename(filePath, path.extname(filePath))
  }
  let cleanName = rawName
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
  
  cleanName = cleanName
    .replace(/\b(Regular|Bold|Italic|VariableFont|Variable|Medium|Light|SemiBold|Thin|Black)\b/gi, '')
    .trim()
    
  return cleanName
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const getFontSlug = (family) => {
  return family.toLowerCase().replace(/\s+/g, '-')
}

const getFontFormat = (ext) => {
  switch (ext) {
    case '.ttf': return "format('truetype')"
    case '.otf': return "format('opentype')"
    case '.woff': return "format('woff')"
    case '.woff2': return "format('woff2')"
    default: return ''
  }
}

const configureFontAssets = async () => {
  try {
    const fontsDir = path.join(process.cwd(), 'public', 'fonts')
    const indexCssPath = path.join(process.cwd(), 'src', 'index.css')

    if (!(await pathExists(fontsDir))) {
      throw new Error(`Directory public/fonts does not exist. Run 'react asset' or create it first.`)
    }

    if (!(await pathExists(indexCssPath))) {
      throw new Error(`Stylesheet src/index.css does not exist.`)
    }

    const fontFiles = await getFontFiles(fontsDir)
    if (fontFiles.length === 0) {
      console.log(chalk.yellow('No font files found under public/fonts/'))
      return
    }

    let cssContent = await readFile(indexCssPath, 'utf8')
    let cssAppended = false

    section('font auto-config', 'scanning and registering local fonts')

    for (const filePath of fontFiles) {
      const ext = path.extname(filePath).toLowerCase()
      const relativeUrlPath = getRelativeUrlPath(filePath)
      
      const escapedPath = escapeRegExp(relativeUrlPath)
      const urlRegex = new RegExp(`url\\(['"]?${escapedPath}['"]?\\)`, 'i')
      if (urlRegex.test(cssContent)) {
        continue
      }

      const family = getFontFamily(filePath)
      const slug = getFontSlug(family)
      const formatStr = getFontFormat(ext)
      
      const fileNameLower = path.basename(filePath).toLowerCase()
      const style = fileNameLower.includes('italic') ? 'italic' : 'normal'
      let weight = 'normal'
      if (fileNameLower.includes('variable')) {
        weight = '100 900'
      } else if (fileNameLower.includes('bold')) {
        weight = 'bold'
      } else if (fileNameLower.includes('semibold') || fileNameLower.includes('demibold')) {
        weight = '600'
      } else if (fileNameLower.includes('medium')) {
        weight = '500'
      } else if (fileNameLower.includes('light')) {
        weight = '300'
      } else if (fileNameLower.includes('thin')) {
        weight = '100'
      }

      const faceBlock = `
@font-face {
  font-family: '${family}';
  src: url('${relativeUrlPath}') ${formatStr};
  font-weight: ${weight};
  font-style: ${style};
}`

      let themeBlock = ''
      if (!cssContent.includes(`--font-${slug}:`) && !cssContent.includes(`--font-${slug} `)) {
        themeBlock = `

@theme {
  --font-${slug}: "${family}", sans-serif;
}`
      }

      let utilityBlock = ''
      if (!cssContent.includes(`.font-${slug} `) && !cssContent.includes(`.font-${slug}{`)) {
        utilityBlock = `

@layer utilities {
  .font-${slug} {
    font-family: var(--font-${slug});
  }
}`
      }

      cssContent += `${faceBlock}${themeBlock}${utilityBlock}\n`
      cssAppended = true
      pass(`registered ${family} (${path.basename(filePath)})`)
    }

    if (cssAppended) {
      await writeFile(indexCssPath, cssContent)
      console.log(chalk.green.bold('\n✔ src/index.css successfully updated with custom font classes!'))
    } else {
      console.log(chalk.gray('\nAll fonts are already configured in src/index.css'))
    }
  } catch (error) {
    fail(error.message)
  }
}

const getImageFiles = async (dir, filesList = []) => {
  const entries = await readDir(dir).catch(() => [])
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      await getImageFiles(fullPath, filesList)
    } else {
      const ext = path.extname(entry).toLowerCase()
      if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'].includes(ext)) {
        filesList.push(fullPath)
      }
    }
  }
  return filesList
}

const getImageKey = (filePath, imagesDir) => {
  const relativePath = path.relative(imagesDir, filePath)
  const ext = path.extname(relativePath)
  const baseName = relativePath.slice(0, -ext.length)
  const parts = baseName.split(/[\\/_\-\s]+/).filter(Boolean)
  
  if (parts.length === 0) return 'image'
  
  return parts.map((part, index) => {
    const cleanPart = part.replace(/[^a-zA-Z0-9]/g, '')
    if (index === 0) {
      return cleanPart.toLowerCase()
    }
    return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1).toLowerCase()
  }).join('')
}

const configureImageAssets = async () => {
  try {
    const imagesDir = path.join(process.cwd(), 'public', 'images')
    const utilsDir = path.join(process.cwd(), 'src', 'utils')
    const imagesJsPath = path.join(utilsDir, 'images.js')

    if (!(await pathExists(imagesDir))) {
      throw new Error(`Directory public/images does not exist. Run 'react asset' or create it first.`)
    }

    const imageFiles = await getImageFiles(imagesDir)
    if (imageFiles.length === 0) {
      console.log(chalk.yellow('No image files found under public/images/'))
      return
    }

    section('image auto-config', 'scanning and mapping local images')

    const imageMap = {}
    for (const filePath of imageFiles) {
      const key = getImageKey(filePath, imagesDir)
      const relativeUrlPath = getRelativeUrlPath(filePath)
      imageMap[key] = relativeUrlPath
      pass(`mapped image: ${key} ➔ ${relativeUrlPath}`)
    }

    const sortedKeys = Object.keys(imageMap).sort()
    let jsContent = 'export const images = {\n'
    for (const key of sortedKeys) {
      jsContent += `  ${key}: '${imageMap[key]}',\n`
    }
    jsContent += '}\n'

    await ensureDir(utilsDir)
    await writeFile(imagesJsPath, jsContent)
    console.log(chalk.green.bold('\n✔ src/utils/images.js successfully generated with custom image constants!'))
  } catch (error) {
    fail(error.message)
  }
}


const collectRequestBody = (req) => new Promise((resolve, reject) => {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk
    if (body.length > maxWatchBodyBytes) {
      reject(new Error('Request body too large'))
      req.destroy()
    }
  })
  req.on('end', () => resolve(body))
  req.on('error', reject)
})

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(payload))
}

const findLocalPort = (preferredPort) => new Promise((resolve, reject) => {
  const probe = http.createServer()
  probe.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      resolve(findLocalPort(preferredPort + 1))
      return
    }
    reject(error)
  })
  probe.once('listening', () => {
    const { port } = probe.address()
    probe.close(() => resolve(port))
  })
  probe.listen(preferredPort, '127.0.0.1')
})

const findWatchPort = (preferredPort) => findLocalPort(preferredPort)

const collectSetupUiSelections = async ({ displayName }) => {
  const token = randomBytes(24).toString('hex')
  const preferredPort = setupUiPortStart
  const port = await findLocalPort(preferredPort)
  const submitUrl = `http://127.0.0.1:${port}/api/setup`
  const startTime = Date.now()

  let server
  let timeout

  const selections = await new Promise((resolve, reject) => {
    let resolved = false

    const close = (callback) => {
      clearTimeout(timeout)
      if (!server || !server.listening) {
        callback()
        return
      }
      server.close(callback)
    }

    const finish = (callback) => {
      if (resolved) return
      resolved = true
      close(callback)
    }

    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)

        if (req.method === 'OPTIONS') {
          sendJson(res, 204, {})
          return
        }

        if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/') {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
          })
          const elapsed = Date.now() - startTime
          const timeLeftMs = Math.max(0, 10 * 60 * 1000 - elapsed)
          const dynamicHtml = await createSetupUiHtml({ displayName, token, submitUrl, timeLeftMs })
          res.end(dynamicHtml)
          return
        }

        if (req.method === 'GET' && url.pathname === '/style.css') {
          const css = await readSetupUiStyle()
          res.writeHead(200, {
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
          })
          res.end(css)
          return
        }

        if (req.method === 'POST' && url.pathname === '/api/setup') {
          const body = await collectRequestBody(req)
          const payload = JSON.parse(body || '{}')
          if (payload.token !== token) {
            sendJson(res, 403, { ok: false, error: 'Invalid setup session token' })
            return
          }

          const normalized = normalizeUiSelections(payload)
          sendJson(res, 200, { ok: true, message: 'Setup received. Continue in terminal.' })
          finish(() => resolve(normalized))
          return
        }

        if (req.method === 'POST' && url.pathname === '/api/cancel') {
          const body = await collectRequestBody(req)
          const payload = JSON.parse(body || '{}')
          if (payload.token !== token) {
            sendJson(res, 403, { ok: false, error: 'Invalid setup session token' })
            return
          }

          sendJson(res, 200, { ok: true, message: 'Setup cancelled.' })
          setTimeout(() => {
            finish(() => reject(new Error('Setup cancelled by user')))
          }, 100)
          return
        }

        if (req.method === 'GET') {
          const errHtmlPath = path.join(rootDir, 'templates', 'setup-ui', '404.html')
          if (await pathExists(errHtmlPath)) {
            const rawErrHtml = await readFile(errHtmlPath)
            const errHtml = rawErrHtml.replace(/__SESSION_TOKEN__/g, token)
            res.writeHead(404, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store, max-age=0',
            })
            res.end(errHtml)
            return
          }
        }

        sendJson(res, 404, { ok: false, error: 'Not found' })
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message })
      }
    })

    server.once('error', (error) => finish(() => reject(error)))
    server.listen(port, '127.0.0.1', () => {
      section('setup ui', 'local browser wizard')
      console.log(`${muted('open')}     ${strong(`http://127.0.0.1:${port}/?token=${token}`)}`)
      console.log(`${muted('project')}  ${strong(displayName)}`)
      console.log(`${muted('scope')}    ${chalk.white('127.0.0.1 only · browser selections are validated again in the CLI')}`)
      console.log(`${muted('timeout')}  ${chalk.white('10 minutes')}\n`)
    })

    timeout = setTimeout(() => {
      finish(() => reject(new Error('Setup UI timed out after 10 minutes')))
    }, 10 * 60 * 1000)
  })

  return selections
}

const printFrontendLog = (payload) => {
  const ok = payload.ok === true
  const status = ok ? chalk.green(payload.status) : chalk.red(payload.status)
  const method = chalk.hex('#6FA8DC').bold(String(payload.method || 'GET').toUpperCase())
  const duration = chalk.gray(`${payload.durationMs || 0}ms`)
  const url = chalk.white(String(payload.url || 'unknown url'))
  const time = chalk.gray(new Date().toLocaleTimeString())

  console.log(`${time} ${method} ${status} ${duration}`)
  console.log(`${muted('url')}      ${url}`)

  if (payload.response) {
    console.log(`${muted(payload.bodyLabel || 'response')}`)
    String(payload.response)
      .split('\n')
      .forEach((line) => console.log(`  ${chalk.white(line)}`))
  }

  console.log('')
}

const watchFrontendLogs = async () => {
  try {
    const packageJson = await readCurrentPackageJson()
    const dependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    }

    if (!dependencies.react) {
      throw new Error('This folder does not look like a React project.')
    }

    const port = await findWatchPort(watchPortStart)
    const server = http.createServer(async (req, res) => {
      try {
        if (req.method === 'OPTIONS') {
          sendJson(res, 204, {})
          return
        }

        if (req.method === 'GET' && req.url === '/health') {
          sendJson(res, 200, { ok: true })
          return
        }

        if (req.method === 'POST' && req.url === '/api/frontend-logs') {
          const body = await collectRequestBody(req)
          const payload = JSON.parse(body || '{}')
          printFrontendLog(payload)
          sendJson(res, 201, { ok: true })
          return
        }

        sendJson(res, 404, { error: 'Not found' })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))

    section('watch', 'frontend API responses')
    console.log(`${muted('project')}  ${strong(packageJson.name || path.basename(process.cwd()))}`)
    console.log(`${muted('listens')}  ${strong(`http://127.0.0.1:${port}`)}`)
    console.log(`${muted('usage')}    ${chalk.white('Run your React app, then fetch any API in the browser.')}`)
    console.log(`${muted('scope')}    ${chalk.white('Frontend fetch() and XHR responses only. No Node/server process is watched.')}`)
    console.log(`${muted('stop')}     ${chalk.white('Ctrl + C')}\n`)

    await new Promise((resolve) => {
      const stop = () => {
        server.close(resolve)
      }

      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    })
  } catch (error) {
    fail(error.message)
  }
}

const configureProjectPort = async (projectPath, port) => {
  const packageJsonPath = path.join(projectPath, 'package.json')
  if (await pathExists(packageJsonPath)) {
    const raw = await readFile(packageJsonPath)
    try {
      const packageJson = JSON.parse(raw)
      if (packageJson && packageJson.scripts) {
        packageJson.scripts.dev = `vite --port ${port}`
        await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
      }
    } catch (e) {
      fail(`Failed to parse or configure project port: ${e.message}`)
    }
  }
}

const createProject = async (name, options) => {
  try {
    validateProjectName(name)

    const isCurrentDirectory = name === '.'
    const projectPath = isCurrentDirectory ? process.cwd() : path.resolve(process.cwd(), name)
    const displayName = isCurrentDirectory ? path.basename(process.cwd()) : name
    const commandTarget = isCurrentDirectory ? '.' : name

    if (await pathExists(projectPath)) {
      const entries = await readDir(projectPath)
      if (entries.length > 0) {
        fail('Directory already exists and is not empty')
      }
    }

    intro(accent('react-cli'))
    printCliHeader({ displayName, commandTarget })
    printConfigPreview()
    printBanner()

    const flagsMode = hasSelectedFlags(options)
    const selections = options.ui
      ? await collectSetupUiSelections({ displayName })
      : flagsMode
      ? {
          selectedPackages: getSelectedFlagPackages(options),
          selectedSetup: getSelectedFlagSetup(options),
          selectedFolders: getSelectedFlagFolders(options).filter((value) => !folderFlags.includes(value)),
          shouldRunDevServer: true,
        }
      : await runInteractivePrompts()

    const progress = createProgress(createSetupSteps(selections.selectedPackages, selections.selectedSetup))
    progress.start()

    await progress.step(async () => {
      await runCommand(
        'npm',
        ['create', 'vite@latest', commandTarget, '--', '--template', 'react'],
        { stdio: 'pipe' },
        'Failed to scaffold Vite project',
      )
    })

    await progress.step(async () => {
      await deleteViteBoilerplate(projectPath)
      await createSelectedFolders(projectPath, selections.selectedFolders)
      await applyBaseTemplates(projectPath, selections.selectedSetup)
      if (selections.createdFiles && selections.createdFiles.length > 0) {
        await createCustomFiles(projectPath, selections.createdFiles)
      }
      if (selections.devServerPort) {
        await configureProjectPort(projectPath, selections.devServerPort)
      }
      await configureIndexHtml(projectPath, displayName)
    })

    await progress.step(async () => {
      await runCommand('npm', ['install'], { cwd: projectPath }, 'Failed to install base dependencies')
    })

    for (const packageName of selections.selectedPackages) {
      await progress.step(async () => {
        await postInstallHandlers[packageName](projectPath)
      })
    }

    if (selections.selectedSetup.includes('env')) {
      await progress.step(async () => {
        await configureEnv(projectPath)
      })
    }

    await progress.step(async () => {})
    progress.done()

    printProjectPreview({
      displayName,
      selectedFolders: selections.selectedFolders,
      selectedSetup: selections.selectedSetup,
    })

    printSummary({
      displayName,
      selectedFolders: selections.selectedFolders,
      selectedSetup: selections.selectedSetup,
      commandTarget,
    })

    if (selections.shouldRunDevServer) {
      await runCommand(
        'npm',
        ['run', 'dev', '--', '--host', '0.0.0.0'],
        { cwd: projectPath, stdio: 'inherit' },
        'Failed to run development server',
      )
    }
  } catch (error) {
    fail(error.message)
  }
}

const gitPushWrapper = async (options) => {
  const steps = []
  let gitDirExists = await pathExists(path.join(process.cwd(), '.git'))

  if (options.github) {
    const isGitHubUrl = /^(https?:\/\/|git@|git:\/\/)/.test(options.github) || options.github.endsWith('.git')
    
    if (isGitHubUrl) {
      steps.push(
        {
          label: 'Initialize Git repository',
          cmd: 'git',
          args: ['init'],
        },
        {
          label: 'Stage all files',
          cmd: 'git',
          args: ['add', '.'],
        },
        {
          label: 'Create first commit: "first commit"',
          cmd: 'git',
          args: ['commit', '-m', 'first commit'],
        },
        {
          label: 'Rename branch to main',
          cmd: 'git',
          args: ['branch', '-M', 'main'],
        },
        {
          label: `Add remote origin (${options.github})`,
          cmd: 'git',
          args: ['remote', 'add', 'origin', options.github],
        },
        {
          label: 'Push branch main to origin',
          cmd: 'git',
          args: ['push', '-u', 'origin', 'main'],
        },
      )
    } else {
      steps.push(
        {
          label: 'Stage all files',
          cmd: 'git',
          args: ['add', '.'],
        },
        {
          label: `Create commit: "${options.github}"`,
          cmd: 'git',
          args: ['commit', '-m', options.github],
        },
        {
          label: 'Push changes',
          cmd: 'git',
          args: ['push'],
        },
      )
    }
  } else {
    const repoUrl = options.git
    const commitMessage = options.message || (repoUrl ? 'first commit' : 'update')
    
    if (!gitDirExists && !repoUrl) {
      fail('Error: This directory is not a Git repository. Please initialize it by providing the remote URL: react push --git <url>')
    }

    if (!gitDirExists) {
      steps.push(
        {
          label: 'Initialize Git repository',
          cmd: 'git',
          args: ['init'],
        },
        {
          label: 'Create and switch to main branch',
          cmd: 'git',
          args: ['checkout', '-b', 'main'],
        },
        {
          label: 'Stage all files',
          cmd: 'git',
          args: ['add', '.'],
        },
        {
          label: `Create first commit: "${commitMessage}"`,
          cmd: 'git',
          args: ['commit', '-m', commitMessage],
        },
        {
          label: `Add remote origin (${repoUrl})`,
          cmd: 'git',
          args: ['remote', 'add', 'origin', repoUrl],
        },
        {
          label: 'Push branch main to origin',
          cmd: 'git',
          args: ['push', '-u', 'origin', 'main'],
        },
      )
    } else {
      // Subsequent update
      steps.push(
        {
          label: 'Stage all files',
          cmd: 'git',
          args: ['add', '.'],
        },
        {
          label: `Create commit: "${commitMessage}"`,
          cmd: 'git',
          args: ['commit', '-m', commitMessage],
        },
        {
          label: 'Push branch main to origin',
          cmd: 'git',
          args: ['push', '-u', 'origin', 'main'],
        },
      )
    }
  }

  section('git setup & push', gitDirExists ? 'pushing updates' : 'linking workspace to remote')

  for (const step of steps) {
    const cmdStr = `${step.cmd} ${step.args.join(' ')}`
    const displayLabel = `${strong(step.label)} (${muted(cmdStr)})`
    
    process.stdout.write(`${muted('running')}  ${displayLabel}...`)
    try {
      const result = await execa(step.cmd, step.args, { cwd: process.cwd() })
      
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      console.log(`${chalk.green('✔ success')}  ${displayLabel}`)
      
      if (result.stdout && result.stdout.trim()) {
        console.log(result.stdout.trim().split('\n').map(line => `${muted('  │')} ${muted(line)}`).join('\n'))
      }
    } catch (error) {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      
      // Handle nothing to commit scenario gracefully
      if (step.args.includes('commit') && (error.stdout || error.message || '').includes('nothing to commit')) {
        console.log(`${chalk.yellow('⚠ skipped')}  ${displayLabel} (nothing to commit, working tree clean)`)
        continue
      }

      console.log(`${chalk.red('✖ failed')}   ${displayLabel}`)
      console.error(chalk.red(`\nError: Command failed: ${cmdStr}`))
      console.error(chalk.red(`${error.stderr || error.message}\n`))
      
      if (step.args.includes('remote') && step.args.includes('add')) {
        console.error(chalk.yellow(`Tip: If remote "origin" already exists, run 'git remote remove origin' first.`))
      }
      process.exit(1)
    }
  }

  console.log(`\n${chalk.green.bold('✔ Project successfully pushed to Git remote!')}`)
}

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
  .command('update')
  .description('Show outdated dependencies without upgrading')
  .action(checkUpdates)

program
  .command('run')
  .description('Run npm run dev with host enabled')
  .option('--port <port>', 'Vite dev server port')
  .action(runDevServer)

program
  .command('asset')
  .description('Create public/assets folders for images, icons, and fonts')
  .action(createAssetFolders)

const envCommand = program
  .command('env')
  .description('Manage Vite .env variables')

envCommand
  .command('list')
  .description('List .env variables')
  .action(envList)

envCommand
  .command('add <key> <value>')
  .description('Add or update a VITE_ environment variable')
  .action(envAdd)

envCommand
  .command('remove <key>')
  .description('Remove a VITE_ environment variable')
  .action(envRemove)

program
  .command('make <folder> <name> [subfolder]')
  .description('Create a file inside an existing src folder')
  .action(makeFile)

program
  .command('set')
  .description('Configure project assets or environment settings')
  .option('--font', 'Scan public/fonts and configure @font-face and Tailwind fonts in src/index.css')
  .option('--image', 'Scan public/images and generate src/utils/images.js constants')
  .action(async (options) => {
    if (options.font) {
      await configureFontAssets()
    } else if (options.image) {
      await configureImageAssets()
    } else {
      console.error(chalk.red('Error: Please specify what to set (e.g. --font or --image)'))
      process.exit(1)
    }
  })

program
  .command('push')
  .description('Initialize Git and push the current workspace to a remote repository')
  .option('--git <url>', 'Git remote repository URL (origin)')
  .option('--github <arg>', 'Git remote repository URL or subsequent push commit message')
  .option('-m, --message <message>', 'Git commit message')
  .action(gitPushWrapper)

program
  .argument('<name>', 'project name or . for current directory')
  .option('--tailwind', 'install tailwindcss + @tailwindcss/vite')
  .option('--axios', 'install axios')
  .option('--socket', 'install socket.io-client')
  .option('--toast', 'install react-toastify')
  .option('--icon', 'install react-icons')
  .option('--lucide', 'install lucide-react')
  .option('--router', 'install react-router-dom and create src/router')
  .option('--qr', 'install react-qr-code')
  .option('--webcam', 'install react-webcam')
  .option('--printer', 'install react-to-print')
  .option('--env', 'create a .env file with Vite environment variables')
  .option('--watch', 'add frontend API watch client for react watch')
  .option('--ui', 'configure setup in a local browser wizard')
  .action(createProject)

program.parseAsync(process.argv).catch((error) => {
  fail(error.message)
})
