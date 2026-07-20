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
  ['react audit', 'Audit project dependencies for security vulnerabilities'],
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
  ['react set form -name -email', 'Generate a styled React Form component with state and field icons'],
  ['pkg axios', 'Install a package or alias in an existing project'],
  ['pkg --dev @types/node', 'Install a package as a dev dependency'],
]

const packageOptions = [
  { value: 'tailwind', label: 'Tailwind CSS', hint: 'style engine + Vite plugin' },
  { value: 'axios', label: 'Axios', hint: 'typed API client starter' },
  { value: 'socket', label: 'Socket.IO Client', hint: 'realtime websocket layer' },
  { value: 'toast', label: 'React Hot Toast', hint: 'toast notifications + Toaster' },
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const typePrint = async (text, speedMs = 6) => {
  if (!text) return
  if (!process.stdout.isTTY) {
    console.log(text)
    return
  }

  const parts = text.split(/(\x1B\[[0-9;]*[A-Za-z])/g)

  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('\x1B[')) {
      process.stdout.write(part)
    } else {
      for (let i = 0; i < part.length; i++) {
        process.stdout.write(part[i])
        await sleep(speedMs)
      }
    }
  }
  process.stdout.write('\n')
}

const section = async (label, meta = '') => {
  const rule = muted('·'.repeat(54))
  await typePrint(`\n${accent(label.toUpperCase())} ${rule} ${muted(meta)}`, 6)
}

const row = async (label, value, hint = '') => {
  await typePrint(`${muted(label.padEnd(12))}${strong(value)} ${hint ? muted(` ${hint}`) : ''}`, 6)
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


  // const banner = [
  //   "╔═════════════════════════════════════════════════════════════════════════════╗",
  //   "║                                                                             ║",
  //   "║                                                                             ║",
  //   "║                                                                             ║",
  //   "║                 ██████╗ ██████╗  █████╗ ██████╗ ██╗  ██╗                    ║",
  //   "║                ██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝                    ║",
  //   "║                ╚█████╗  ██████╔╝███████║██████╔╝█████╔╝                     ║",
  //   "║                 ╚═══██╗ ██╔═══╝ ██╔══██║██╔══██╗██╔═██╗                     ║",
  //   "║                ██████╔╝ ██║     ██║  ██║██║  ██║██║  ██╗                    ║",
  //   "║                ╚═════╝  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝                    ║",
  //   "║                                                                             ║",
  //   "║                                                                             ║",
  //   "║                                                                             ║",
  //   "║                                                                             ║",
  //   "╚═════════════════════════════════════════════════════════════════════════════╝",
  // ];

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

const fail = async (message) => {
  await typePrint(chalk.red(message), 6)
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

const pass = async (message, hint = '') => {
  await typePrint(`${chalk.green('✓')} ${strong(message)} ${hint ? muted(hint) : ''}`, 6)
}

const warn = async (message, hint = '') => {
  await typePrint(`${chalk.yellow('!')} ${strong(message)} ${hint ? muted(hint) : ''}`, 6)
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

const runAudit = async () => {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    if (!(await pathExists(packageJsonPath))) {
      warn('package.json missing', 'run this inside a Node/React project')
      return
    }

    section('audit', 'dependency vulnerability check')
    console.log(muted('Running security audit...\n'))

    const auditRes = await execa('npm', ['audit', '--json'], { cwd: process.cwd(), reject: false })

    if (auditRes.exitCode >= 2) {
      throw new Error(`npm audit failed to execute: ${auditRes.stderr || auditRes.stdout}`)
    }

    let auditData
    try {
      auditData = JSON.parse(auditRes.stdout)
    } catch (e) {
      if (auditRes.stderr && auditRes.stderr.includes('ENOTFOUND')) {
        throw new Error('Network error: Could not reach the npm registry. Please check your internet connection.')
      }
      throw new Error(`Failed to parse npm audit output: ${auditRes.stderr || auditRes.stdout || e.message}`)
    }

    const vulnerabilities = auditData.vulnerabilities || {}
    const vulnKeys = Object.keys(vulnerabilities)
    const total = auditData.metadata?.vulnerabilities?.total || vulnKeys.length

    if (total === 0 || vulnKeys.length === 0) {
      pass('No vulnerabilities found!')
      console.log(`\nHello! Your project looks completely secure. The project is safe for further development process.\n`)
      return
    }

    const counts = auditData.metadata?.vulnerabilities || {}
    const countSummary = []
    if (counts.critical) countSummary.push(`${counts.critical} critical`)
    if (counts.high) countSummary.push(`${counts.high} high`)
    if (counts.moderate) countSummary.push(`${counts.moderate} moderate`)
    if (counts.low) countSummary.push(`${counts.low} low`)
    if (counts.info) countSummary.push(`${counts.info} info`)

    const countStr = countSummary.join(', ') || `${total} total`
    console.log(chalk.red(`Found ${total} vulnerabilities (${countStr})\n`))

    for (const pkgName of vulnKeys) {
      const vuln = vulnerabilities[pkgName]
      const severity = vuln.severity
      const via = vuln.via || []
      
      const reasons = via.map(v => typeof v === 'object' ? v.title : `dependent package "${v}"`).filter(Boolean)
      const reasonStr = reasons.length > 0 ? reasons.join('; ') : 'Unknown issue'
      
      const directStr = vuln.isDirect ? chalk.yellow('direct dependency') : chalk.gray('transitive dependency')
      const severityColor = severity === 'critical' || severity === 'high' ? chalk.red : chalk.yellow
      
      console.log(`  ${strong(pkgName)} (${severityColor(severity)})`)
      console.log(`  ${muted('├─ type:')}     ${directStr}`)
      console.log(`  ${muted('├─ reason:')}   ${chalk.white(reasonStr)}`)
      
      if (vuln.fixAvailable) {
        if (typeof vuln.fixAvailable === 'object') {
          const fix = vuln.fixAvailable
          const semverStr = fix.isSemVerMajor ? chalk.red('major breaking update') : chalk.green('semver compatible')
          console.log(`  ${muted('└─ fix:')}      ${chalk.green(`upgrade to ${fix.name}@${fix.version}`)} (${semverStr})`)
        } else if (vuln.fixAvailable === true) {
          console.log(`  ${muted('└─ fix:')}      ${chalk.green('fix available via npm audit fix')}`)
        } else {
          console.log(`  ${muted('└─ fix:')}      ${chalk.gray('no simple fix available')}`)
        }
      } else {
        console.log(`  ${muted('└─ fix:')}      ${chalk.gray('no fix available')}`)
      }
      console.log('')
    }

    const confirmFix = await customConfirm({
      message: 'Would you like to run audit fix?',
      initialValue: true,
    })

    if (!confirmFix) {
      console.log(chalk.yellow('\nAudit fix aborted.'))
      return
    }

    console.log(chalk.gray('\nRunning npm audit fix...'))
    const fixRes = await execa('npm', ['audit', 'fix'], { cwd: process.cwd(), reject: false })

    if (fixRes.stdout && fixRes.stdout.trim()) {
      console.log(fixRes.stdout.trim())
    }
    if (fixRes.stderr && fixRes.stderr.trim()) {
      console.error(fixRes.stderr.trim())
    }

    console.log(chalk.gray('\nVerifying resolutions...'))
    const postAuditRes = await execa('npm', ['audit', '--json'], { cwd: process.cwd(), reject: false })

    let postAuditData
    try {
      postAuditData = JSON.parse(postAuditRes.stdout)
    } catch (e) {
      postAuditData = { vulnerabilities: {} }
    }

    const postVulns = postAuditData.vulnerabilities || {}
    const postKeys = Object.keys(postVulns)

    const resolvedList = []
    const remainingList = []

    for (const pkgName of vulnKeys) {
      if (!postVulns[pkgName]) {
        const preVuln = vulnerabilities[pkgName]
        const via = preVuln.via || []
        const reasons = via.map(v => typeof v === 'object' ? v.title : `dependent package "${v}"`).filter(Boolean)
        resolvedList.push({ name: pkgName, severity: preVuln.severity, reason: reasons.join('; ') })
      }
    }

    for (const pkgName of postKeys) {
      const postVuln = postVulns[pkgName]
      const via = postVuln.via || []
      const reasons = via.map(v => typeof v === 'object' ? v.title : `dependent package "${v}"`).filter(Boolean)
      remainingList.push({ name: pkgName, severity: postVuln.severity, reason: reasons.join('; ') })
    }

    console.log(`\n${chalk.green.bold('✔ Audit fix complete!')}\n`)

    if (resolvedList.length > 0) {
      console.log(chalk.green.bold('Resolved:'))
      resolvedList.forEach(r => {
        console.log(`  ${chalk.green('✔')} ${strong(r.name)} (${chalk.green(r.severity)}) - ${r.reason}`)
      })
      console.log('')
    }

    if (remainingList.length > 0) {
      console.log(chalk.yellow.bold('Remaining Issues:'))
      remainingList.forEach(r => {
        console.log(`  ${chalk.yellow('⚠')} ${strong(r.name)} (${chalk.yellow(r.severity)}) - ${r.reason}`)
      })
      console.log(`\n${muted('Some vulnerabilities could not be auto-resolved. They may require manual dependency updates or npm audit fix --force.')}\n`)
    } else {
      console.log(chalk.green('All vulnerabilities have been resolved successfully! The project is safe for further development process.\n'))
    }
  } catch (error) {
    fail(error.message)
  }
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

// Escape a value for safe insertion inside a quoted CSS string (font-family, url()).
const escapeCssString = (value) =>
  Array.from(String(value))
    .map((ch) => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? ' ' : ch))
    .join('')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')

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
      if (['.ttf', '.woff', '.woff2', '.otf', '.ttc'].includes(ext)) {
        filesList.push(fullPath)
      }
    }
  }
  return filesList
}

const getFontFormat = (ext) => {
  switch (ext.toLowerCase()) {
    case '.ttf':
    case '.ttc': return 'format("truetype")'
    case '.otf': return 'format("opentype")'
    case '.woff': return 'format("woff")'
    case '.woff2': return 'format("woff2")'
    default: return ''
  }
}

const parseFontInfo = (filePath) => {
  const ext = path.extname(filePath)
  const filename = path.basename(filePath, ext)
  const lowerName = filename.toLowerCase()

  const style = lowerName.includes('italic') ? 'italic' : 'normal'

  let weight = 400
  let suffix = ''

  if (lowerName.includes('variable')) {
    weight = '100 900'
    suffix = ''
  } else if (lowerName.includes('black') || lowerName.includes('heavy')) {
    weight = 900
    suffix = ''
  } else if (lowerName.includes('extrabold') || lowerName.includes('ultrabold')) {
    weight = 800
    suffix = '-xb'
  } else if (lowerName.includes('semibold') || lowerName.includes('demibold')) {
    weight = 600
    suffix = '-s'
  } else if (lowerName.includes('bold')) {
    weight = 700
    suffix = '-b'
  } else if (lowerName.includes('medium')) {
    weight = 500
    suffix = '-m'
  } else if (lowerName.includes('regular') || lowerName.includes('book')) {
    weight = 400
    suffix = ''
  } else if (lowerName.includes('extralight') || lowerName.includes('ultralight')) {
    weight = 200
    suffix = '-xl'
  } else if (lowerName.includes('light')) {
    weight = 300
    suffix = '-l'
  } else if (lowerName.includes('thin') || lowerName.includes('hairline')) {
    weight = 100
    suffix = '-t'
  }

  let cleanName = filename
    .replace(/[-_]/g, ' ')
    .replace(/\b(ExtraBold|UltraBold|SemiBold|DemiBold|ExtraLight|UltraLight|Regular|Bold|Italic|VariableFont|Variable|Medium|Light|Thin|Black|Heavy|Book|Hairline)\b/gi, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleanName) {
    cleanName = filename.replace(/[-_]/g, ' ').trim()
  }

  const baseFamily = cleanName
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  const fontFamily = `${baseFamily}${suffix}`

  return {
    filename,
    ext,
    baseFamily,
    fontFamily,
    weight,
    style,
    format: getFontFormat(ext),
  }
}

const getThemeSlug = (fontFamily, usedSlugs) => {
  let primarySlug = fontFamily.split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (fontFamily.includes('-')) {
    primarySlug = fontFamily.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
  if (!usedSlugs.has(primarySlug)) {
    usedSlugs.add(primarySlug)
    return primarySlug
  }
  let fullSlug = fontFamily.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  usedSlugs.add(fullSlug)
  return fullSlug
}

const configureFontAssets = async () => {
  try {
    const fontsDirPrimary = path.join(process.cwd(), 'public', 'fonts')
    const fontsDirSecondary = path.join(process.cwd(), 'public', 'assets', 'fonts')
    const indexCssPath = path.join(process.cwd(), 'src', 'index.css')

    const hasPrimary = await pathExists(fontsDirPrimary)
    const hasSecondary = await pathExists(fontsDirSecondary)

    if (!hasPrimary && !hasSecondary) {
      throw new Error(`Font directory (public/fonts or public/assets/fonts) does not exist. Run 'react asset' or create it first.`)
    }

    if (!(await pathExists(indexCssPath))) {
      throw new Error(`Stylesheet src/index.css does not exist.`)
    }

    let rawFontFiles = []
    if (hasPrimary) {
      const files = await getFontFiles(fontsDirPrimary)
      rawFontFiles.push(...files)
    }
    if (hasSecondary) {
      const files = await getFontFiles(fontsDirSecondary)
      rawFontFiles.push(...files)
    }

    // Deduplicate font files by relative URL path
    const fileMap = new Map()
    for (const f of rawFontFiles) {
      const relUrl = getRelativeUrlPath(f)
      if (!fileMap.has(relUrl)) {
        fileMap.set(relUrl, f)
      }
    }
    const fontFiles = Array.from(fileMap.values())

    if (fontFiles.length === 0) {
      console.log(chalk.yellow('No font files found under public/fonts/ or public/assets/fonts/'))
      return
    }

    let cssContent = await readFile(indexCssPath, 'utf8')
    let cssAppended = false

    section('font auto-config', 'scanning and registering local fonts')

    const newFontFaceBlocks = []
    const newThemeLines = []
    const usedSlugs = new Set()

    // Collect existing theme slugs if @theme block exists
    const existingThemeVars = cssContent.match(/--font-([a-z0-9-]+)\s*:/g) || []
    existingThemeVars.forEach((v) => {
      const m = v.match(/--font-([a-z0-9-]+)/)
      if (m) usedSlugs.add(m[1])
    })

    for (const filePath of fontFiles) {
      const relUrlPath = getRelativeUrlPath(filePath)
      const escapedPath = escapeRegExp(relUrlPath)
      const urlRegex = new RegExp(`url\\(['"]?${escapedPath}['"]?\\)`, 'i')
      if (urlRegex.test(cssContent)) {
        continue
      }

      const fontInfo = parseFontInfo(filePath)
      const slug = getThemeSlug(fontInfo.fontFamily, usedSlugs)

      const faceBlock = `@font-face {
  font-family: "${escapeCssString(fontInfo.fontFamily)}";
  src: url("${escapeCssString(relUrlPath)}") ${fontInfo.format};
  font-weight: ${fontInfo.weight};
  font-style: ${fontInfo.style};
  font-display: swap;
}`

      newFontFaceBlocks.push(faceBlock)
      newThemeLines.push(`  --font-${slug}: "${escapeCssString(fontInfo.fontFamily)}", sans-serif;`)
      cssAppended = true
      pass(`registered ${fontInfo.fontFamily} (${path.basename(filePath)})`)
    }

    if (!cssAppended) {
      console.log(chalk.gray('\nAll fonts are already configured in src/index.css'))
      return
    }

    let updatedCss = cssContent

    // Insert @font-face blocks
    if (newFontFaceBlocks.length > 0) {
      const fontFaceGroup = '\n' + newFontFaceBlocks.join('\n\n') + '\n'
      const themeIndex = updatedCss.indexOf('@theme')
      if (themeIndex !== -1) {
        updatedCss = updatedCss.slice(0, themeIndex) + fontFaceGroup + '\n' + updatedCss.slice(themeIndex)
      } else {
        updatedCss = updatedCss.trimEnd() + '\n' + fontFaceGroup
      }
    }

    // Insert or update @theme block
    if (newThemeLines.length > 0) {
      const themeRegex = /@theme\s*\{([^}]*)\}/
      if (themeRegex.test(updatedCss)) {
        updatedCss = updatedCss.replace(themeRegex, (match, inner) => {
          const trimmedInner = inner.trimEnd()
          return `@theme {${trimmedInner}\n${newThemeLines.join('\n')}\n}`
        })
      } else {
        const themeBlock = `\n@theme {\n${newThemeLines.join('\n')}\n}\n`
        updatedCss = updatedCss.trimEnd() + '\n' + themeBlock
      }
    }

    await writeFile(indexCssPath, updatedCss)
    console.log(chalk.green.bold('\n✔ src/index.css successfully updated with custom font classes!'))
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
    const imagesDirPrimary = path.join(process.cwd(), 'public', 'images')
    const imagesDirSecondary = path.join(process.cwd(), 'public', 'assets', 'images')
    const utilsDir = path.join(process.cwd(), 'src', 'utils')
    const imagesJsPath = path.join(utilsDir, 'images.js')

    const hasPrimary = await pathExists(imagesDirPrimary)
    const hasSecondary = await pathExists(imagesDirSecondary)

    if (!hasPrimary && !hasSecondary) {
      throw new Error(`Directory public/images or public/assets/images does not exist. Run 'react asset' or create it first.`)
    }

    let imageItems = []
    if (hasPrimary) {
      const files = await getImageFiles(imagesDirPrimary)
      imageItems.push(...files.map(f => ({ filePath: f, dir: imagesDirPrimary })))
    }
    if (hasSecondary) {
      const files = await getImageFiles(imagesDirSecondary)
      imageItems.push(...files.map(f => ({ filePath: f, dir: imagesDirSecondary })))
    }

    if (imageItems.length === 0) {
      console.log(chalk.yellow('No image files found under public/images/ or public/assets/images/'))
      return
    }

    section('image auto-config', 'scanning and mapping local images')

    const imageMap = {}
    for (const item of imageItems) {
      const key = getImageKey(item.filePath, item.dir)
      const relativeUrlPath = getRelativeUrlPath(item.filePath)
      imageMap[key] = relativeUrlPath
      pass(`mapped image: ${key} ➔ ${relativeUrlPath}`)
    }

    const sortedKeys = Object.keys(imageMap).sort()
    let jsContent = 'export const images = {\n'
    for (const key of sortedKeys) {
      jsContent += `  ${key}: ${JSON.stringify(imageMap[key])},\n`
    }
    jsContent += '}\n'

    await ensureDir(utilsDir)
    await writeFile(imagesJsPath, jsContent)
    console.log(chalk.green.bold('\n✔ src/utils/images.js successfully generated with custom image constants!'))
  } catch (error) {
    fail(error.message)
  }
}

const extractRawFormFields = (rawArgs) => {
  const fields = []
  rawArgs.forEach((arg) => {
    if (typeof arg !== 'string') return
    const clean = arg.replace(/^--?/, '').trim()
    if (clean && clean.toLowerCase() !== 'form' && clean.toLowerCase() !== 'set') {
      clean.split(/[\s,]+/).forEach((f) => {
        const fieldKey = f.replace(/^--?/, '').trim()
        if (fieldKey && !fields.includes(fieldKey)) {
          fields.push(fieldKey)
        }
      })
    }
  })
  return fields
}

const getExistingFormFields = async (formJsxPath) => {
  try {
    const exists = await pathExists(formJsxPath)
    if (!exists) return []
    const content = await readFile(formJsxPath, 'utf8')
    const match = content.match(/const\s+\[formData,\s+setFormData\]\s*=\s*useState\(\{([\s\S]*?)\}\)/)
    if (match && match[1]) {
      const keys = []
      const lines = match[1].split('\n')
      lines.forEach((line) => {
        const keyMatch = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/)
        if (keyMatch && keyMatch[1] && !keys.includes(keyMatch[1])) {
          keys.push(keyMatch[1])
        }
      })
      return keys
    }
  } catch (e) {
    return []
  }
  return []
}

const getFieldLucideIcon = (fieldName) => {
  const key = fieldName.toLowerCase()
  if (key.includes('email') || key.includes('mail')) return 'Mail'
  if (key.includes('phone') || key.includes('tel') || key.includes('mobile') || key.includes('contact')) return 'Phone'
  if (key.includes('location') || key.includes('address') || key.includes('city') || key.includes('country') || key.includes('state') || key.includes('zip')) return 'MapPin'
  if (key.includes('password') || key.includes('pass') || key.includes('pin') || key.includes('secret')) return 'Lock'
  if (key.includes('date') || key.includes('dob') || key.includes('birth')) return 'Calendar'
  if (key.includes('search') || key.includes('find')) return 'Search'
  if (key.includes('url') || key.includes('website') || key.includes('link')) return 'Globe'
  if (key.includes('name') || key.includes('user')) return 'User'
  return 'FileText'
}

const getFieldInputType = (fieldName) => {
  const key = fieldName.toLowerCase()
  if (key.includes('email') || key.includes('mail')) return 'email'
  if (key.includes('password') || key.includes('pass') || key.includes('secret')) return 'password'
  if (key.includes('phone') || key.includes('tel') || key.includes('mobile')) return 'tel'
  if (key.includes('date') || key.includes('dob') || key.includes('birth')) return 'date'
  if (key.includes('age') || key.includes('number') || key.includes('amount') || key.includes('count')) return 'number'
  if (key.includes('url') || key.includes('website')) return 'url'
  return 'text'
}

const formatFieldLabel = (fieldName) => {
  const clean = fieldName.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  return clean.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const configureFormBoilerplate = async (rawArgs = []) => {
  try {
    const pkgJson = await readCurrentPackageJson()

    const allDeps = {
      ...(pkgJson.dependencies || {}),
      ...(pkgJson.devDependencies || {}),
    }

    const missingDeps = []
    if (!allDeps['react-hot-toast']) missingDeps.push('react-hot-toast')
    if (!allDeps['lucide-react']) missingDeps.push('lucide-react')

    if (missingDeps.length > 0) {
      console.log(chalk.yellow(`Installing missing dependencies: ${missingDeps.join(', ')}...`))
      await execa('npm', ['install', ...missingDeps], { cwd: process.cwd() })
      pass(`installed ${missingDeps.join(', ')}`)
    }

    const componentsDir = path.join(process.cwd(), 'src', 'components')
    const formJsxPath = path.join(componentsDir, 'Form.jsx')
    const toastJsxPath = path.join(componentsDir, 'Toast.jsx')

    section('form generator', 'building styled form & react-hot-toast system')

    await ensureDir(componentsDir)

    const toastJsxContent = `import { Toaster, toast } from 'react-hot-toast'
import { CheckCircle2, XCircle } from 'lucide-react'

export const CustomToaster = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#18181b',
          color: '#fff',
          border: '1px solid #27272a',
          borderRadius: '0.75rem',
          padding: '12px 16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          fontSize: '14px',
          fontFamily: 'sans-serif',
        },
        success: {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
        },
        error: {
          icon: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
        },
      }}
    />
  )
}

export { toast }
`

    await writeFile(toastJsxPath, toastJsxContent)
    pass(`created ${path.relative(process.cwd(), toastJsxPath)}`)

    const newRequestedFields = extractRawFormFields(rawArgs)
    const existingFields = await getExistingFormFields(formJsxPath)

    let fields = []
    if (existingFields.length > 0) {
      fields = [...existingFields]
      newRequestedFields.forEach((f) => {
        if (!fields.includes(f)) {
          fields.push(f)
        }
      })
    } else {
      fields = newRequestedFields.length > 0 ? newRequestedFields : ['name', 'email', 'phone']
    }

    const stateInit = fields.map((f) => `    ${f}: ''`).join(',\n')
    const stateReset = fields.map((f) => `        ${f}: ''`).join(',\n')

    const lucideIconsUsed = Array.from(new Set(fields.map((f) => getFieldLucideIcon(f))))

    const fieldBlocks = fields.map((f) => {
      const label = formatFieldLabel(f)
      const inputType = getFieldInputType(f)
      const iconName = getFieldLucideIcon(f)

      return `        {/* ${label} Field */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            ${label}
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 pointer-events-none">
              <${iconName} className="w-5 h-5 text-zinc-400" />
            </span>
            <input
              type="${inputType}"
              name="${f}"
              value={formData.${f}}
              onChange={handleChange}
              placeholder="Enter your ${label.toLowerCase()}"
              className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500 focus:border-transparent rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none transition-all"
            />
          </div>
        </div>`
    }).join('\n\n')

    const formJsxContent = `import { useState } from 'react'
import { ${lucideIconsUsed.join(', ')} } from 'lucide-react'
import { CustomToaster as Toaster, toast } from './Toast'

const Form = () => {
  const [formData, setFormData] = useState({
${stateInit}
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateField = (name, value) => {
    let error = ''
    const val = value ? value.trim() : ''

    if (name === 'name' || name.includes('name')) {
      const nameRegex = /^[a-zA-Z\\s]+$/
      if (!val) {
        error = 'Name is required'
      } else if (val.length < 2) {
        error = 'Name must be at least 2 characters'
      } else if (!nameRegex.test(val)) {
        error = 'Name can only contain letters'
      }
    } else if (name === 'email' || name.includes('mail')) {
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
      if (!val) {
        error = 'Email is required'
      } else if (!emailRegex.test(val)) {
        error = 'Please enter a valid email address'
      }
    } else if (name === 'phone' || name.includes('tel') || name.includes('mobile')) {
      const phoneRegex = /^[0-9]{10}$/
      if (!val) {
        error = 'Phone number is required'
      } else if (!phoneRegex.test(val.replace(/\\s+/g, ''))) {
        error = 'Phone number must be exactly 10 digits'
      }
    } else if (name === 'password' || name.includes('pass')) {
      if (!val) {
        error = 'Password is required'
      } else if (val.length < 6) {
        error = 'Password must be at least 6 characters'
      }
    } else {
      if (!val) {
        error = name.charAt(0).toUpperCase() + name.slice(1) + ' is required'
      }
    }

    return error
  }

  const validateForm = () => {
    const errors = []
    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key])
      if (err) {
        errors.push(err)
        toast.error(err)
      }
    })
    return errors.length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let val = value

    if (name === 'name' || name.includes('name')) {
      val = value.replace(/[^a-zA-Z\\s]/g, '')
    } else if (name === 'phone' || name.includes('tel') || name.includes('mobile') || name.includes('contact')) {
      val = value.replace(/\\D/g, '').slice(0, 10)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Server error: ' + response.statusText)
      }

      const data = await response.json()
      console.log('Form submission response:', data)
      toast.success('Form submitted successfully!')

      setFormData({
${stateReset}
      })
    } catch (error) {
      console.error('Submission error:', error)
      toast.error(error.message || 'Failed to submit form')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto p-6 md:p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 transition-all">
      <Toaster />
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6 text-center">
        Form
      </h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
${fieldBlocks}

        {/* Submit Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Submitting...</span>
              </>
            ) : (
              <span>Submit</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Form
`

    await writeFile(formJsxPath, formJsxContent)
    pass(`created ${path.relative(process.cwd(), formJsxPath)}`)
    console.log(chalk.green.bold(`\n✔ src/components/Form.jsx and Toast.jsx successfully updated with [${fields.join(', ')}] fields!`))
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

// Reject requests whose Host header is not loopback — blocks DNS-rebinding attacks
// where a remote page rebinds its domain to 127.0.0.1 to reach these local servers.
const isAllowedHost = (req, port) => {
  const host = req.headers.host
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`
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

        if (!isAllowedHost(req, port)) {
          sendJson(res, 403, { ok: false, error: 'Invalid host header' })
          return
        }

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

// Strip ANSI/escape and other control bytes so attacker-controlled log payloads
// cannot inject terminal escape sequences (title/clipboard/output spoofing).
const sanitizeForTerminal = (value) =>
  Array.from(String(value))
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code === 9 || code === 10) return ch
      if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return ''
      return ch
    })
    .join('')

const printFrontendLog = (payload) => {
  const ok = payload.ok === true
  const status = ok ? chalk.green(sanitizeForTerminal(payload.status)) : chalk.red(sanitizeForTerminal(payload.status))
  const method = chalk.hex('#6FA8DC').bold(sanitizeForTerminal(String(payload.method || 'GET').toUpperCase()))
  const duration = chalk.gray(`${Number(payload.durationMs) || 0}ms`)
  const url = chalk.white(sanitizeForTerminal(String(payload.url || 'unknown url')))
  const time = chalk.gray(new Date().toLocaleTimeString())

  console.log(`${time} ${method} ${status} ${duration}`)
  console.log(`${muted('url')}      ${url}`)

  if (payload.response) {
    console.log(`${muted(sanitizeForTerminal(payload.bodyLabel || 'response'))}`)
    sanitizeForTerminal(String(payload.response))
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
        if (!isAllowedHost(req, port)) {
          sendJson(res, 403, { error: 'Invalid host header' })
          return
        }

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

// Reject git remote-helper transports (ext::, fd::, <transport>::) that let a
// remote URL execute arbitrary commands. Allow only standard git transports.
const isSafeRemoteUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return false
  if (url.includes('::')) return false
  if (Array.from(url).some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) return false
  return /^(https?|git|ssh):\/\//i.test(url) || /^[\w.-]+@[\w.-]+:.+$/.test(url)
}

const generateAutoCommitMessage = async () => {
  try {
    const result = await execa('git', ['status', '--porcelain'], { cwd: process.cwd(), reject: false })
    const stdout = result.stdout || ''
    const lines = stdout.trim().split('\n').filter(Boolean)

    if (lines.length === 0) {
      return 'update project files'
    }

    const modifiedFiles = []
    const addedFiles = []
    const deletedFiles = []
    const renamedFiles = []

    lines.forEach((line) => {
      const status = line.slice(0, 2).trim()
      let filePath = line.slice(3).trim()
      if (filePath.includes('->')) {
        filePath = filePath.split('->')[1].trim()
      }
      filePath = filePath.replace(/^"|"$/g, '')

      if (status.includes('D')) {
        deletedFiles.push(filePath)
      } else if (status.includes('A') || status === '??') {
        addedFiles.push(filePath)
      } else if (status.includes('R')) {
        renamedFiles.push(filePath)
      } else {
        modifiedFiles.push(filePath)
      }
    })

    const allChangedFiles = [...modifiedFiles, ...addedFiles, ...deletedFiles, ...renamedFiles]

    if (allChangedFiles.length === 1) {
      const file = allChangedFiles[0]
      const baseName = path.basename(file)

      if (addedFiles.length === 1) return `add ${baseName}`
      if (deletedFiles.length === 1) return `remove ${baseName}`
      if (renamedFiles.length === 1) return `rename ${baseName}`
      return `update ${baseName}`
    }

    const categories = new Set()

    allChangedFiles.forEach((file) => {
      const normalized = file.replace(/\\/g, '/')
      if (normalized.startsWith('src/components/')) {
        categories.add('components')
      } else if (normalized.startsWith('src/pages/')) {
        categories.add('pages')
      } else if (normalized.startsWith('src/hooks/')) {
        categories.add('hooks')
      } else if (normalized.startsWith('src/services/')) {
        categories.add('services')
      } else if (normalized.startsWith('src/store/')) {
        categories.add('state store')
      } else if (normalized.startsWith('src/utils/')) {
        categories.add('utilities')
      } else if (normalized.startsWith('public/fonts/') || normalized.startsWith('public/assets/fonts/')) {
        categories.add('fonts')
      } else if (normalized.startsWith('public/images/') || normalized.startsWith('public/assets/images/')) {
        categories.add('images')
      } else if (normalized.endsWith('.css') || normalized.endsWith('.scss')) {
        categories.add('styling')
      } else if (normalized === 'package.json' || normalized === 'package-lock.json') {
        categories.add('dependencies')
      } else if (normalized === 'vite.config.js' || normalized.startsWith('.env')) {
        categories.add('project config')
      }
    })

    const categoryList = Array.from(categories)

    if (categoryList.length > 0 && categoryList.length <= 3) {
      const action = addedFiles.length > modifiedFiles.length ? 'add and update' : 'update'
      return `${action} ${categoryList.join(', ')}`
    }

    const mainAction = addedFiles.length > modifiedFiles.length ? 'add' : 'update'
    return `${mainAction} project files (${allChangedFiles.length} files changed)`
  } catch (error) {
    return 'update project files'
  }
}

const gitPushWrapper = async (options) => {
  const steps = []
  let gitDirExists = await pathExists(path.join(process.cwd(), '.git'))
  const autoCommitMessage = await generateAutoCommitMessage()

  if (options.github) {
    const isGitHubUrl = typeof options.github === 'string' && (/^(https?:\/\/|git@|git:\/\/)/.test(options.github) || options.github.endsWith('.git'))
    const isFlagOnly = options.github === true

    if (isGitHubUrl) {
      if (!isSafeRemoteUrl(options.github)) {
        fail('Unsafe git remote URL. Use an https://, ssh://, git:// or git@host:path URL.')
      }
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
          label: `Create first commit: "${autoCommitMessage}"`,
          cmd: 'git',
          args: ['commit', '-m', autoCommitMessage],
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
      const commitMessage = isFlagOnly ? autoCommitMessage : options.github
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
          label: 'Push changes',
          cmd: 'git',
          args: ['push'],
        },
      )
    }
  } else {
    const repoUrl = options.git
    const commitMessage = options.message || autoCommitMessage

    if (repoUrl && !isSafeRemoteUrl(repoUrl)) {
      fail('Unsafe git remote URL. Use an https://, ssh://, git:// or git@host:path URL.')
    }

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
      await typePrint(`${chalk.green('✔ success')}  ${displayLabel}`, 6)
      
      if (result.stdout && result.stdout.trim()) {
        const lines = result.stdout.trim().split('\n').map(line => `${muted('  │')} ${muted(line)}`).join('\n')
        await typePrint(lines, 4)
      }
    } catch (error) {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      
      // Handle nothing to commit scenario gracefully
      if (step.args.includes('commit') && (error.stdout || error.message || '').includes('nothing to commit')) {
        await typePrint(`${chalk.yellow('⚠ skipped')}  ${displayLabel} (nothing to commit, working tree clean)`, 6)
        continue
      }

      await typePrint(`${chalk.red('✖ failed')}   ${displayLabel}`, 6)
      await typePrint(chalk.red(`\nError: Command failed: ${cmdStr}`), 6)
      await typePrint(chalk.red(`${error.stderr || error.message}\n`), 6)
      
      if (step.args.includes('remote') && step.args.includes('add')) {
        await typePrint(chalk.yellow(`Tip: If remote "origin" already exists, run 'git remote remove origin' first.`), 6)
      }
      process.exit(1)
    }
  }

  await typePrint(`\n${chalk.green.bold('✔ Project successfully pushed to Git remote!')}`, 6)
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
  .command('audit')
  .description('Audit project dependencies for security vulnerabilities')
  .action(runAudit)

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
  .command('set [target] [fields...]')
  .description('Configure project assets, environment settings, or form components')
  .option('--font', 'Scan public/fonts and configure @font-face and Tailwind fonts in src/index.css')
  .option('--image', 'Scan public/images and generate src/utils/images.js constants')
  .option('--form', 'Generate a styled React Form component with field icons and state')
  .allowUnknownOption()
  .action(async (target, fields, options) => {
    const rawArgs = process.argv.slice(3)
    if (target === 'form' || options.form || rawArgs.some(a => a.toLowerCase().includes('form'))) {
      await configureFormBoilerplate(rawArgs)
    } else if (target === 'font' || options.font) {
      await configureFontAssets()
    } else if (target === 'image' || options.image) {
      await configureImageAssets()
    } else {
      console.error(chalk.red('Error: Please specify what to set (e.g. set form -name -email, --font, or --image)'))
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
  .command('push')
  .description('Initialize Git and push the current workspace to a remote repository')
  .option('--git <url>', 'Git remote repository URL (origin)')
  .option('--github [arg]', 'Git remote repository URL or subsequent push commit message')
  .option('-m, --message <message>', 'Git commit message')
  .action(gitPushWrapper)

program
  .argument('<name>', 'project name or . for current directory')
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
  .action(createProject)

program.parseAsync(process.argv).catch((error) => {
  fail(error.message)
})
