import path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
import { section, pass, warn, fail, accent, muted, strong } from '../ui/banner.js'
import { packageFlags, setupFlags, defaultFlagFolders, folderFlags, packageOptions, folderOptions } from '../ui/banner.js'
import { createProgress, customMultiselect, customConfirm, customText } from '../ui/prompts.js'
import {
  rootDir,
  pathExists,
  ensureDir,
  removePath,
  readFile,
  writeFile,
  copyFile,
  createViteApp,
  detectPackageManager,
  ensureGitignoreWithEnv,
  configureEnv,
  createPackageHandlers,
  runCommand,
  cliIconContent,
  projectNameRegex,
  validateDevServerPort,
  isPortAvailable,
  setViteServerPort,
} from '../shared.js'
import { startSetupWizardServer } from '../commands/wizard.js'
import { CustomCreatedFile, UiSelections } from '../types/index.js'
import { configureBonjourBoilerplate, mdnsPackageName } from './bonjour.js'
import { configureLogscan, logscanPackageSpec } from './logscan.js'

export const validateProjectName = (name: string): void => {
  if (!projectNameRegex.test(name) || name.includes('..') || name.includes('/')) {
    fail('Invalid project name')
  }
}

export const defaultDevServerPort = 5173

// --port on the non-interactive path gets the same rules as the prompt
export const resolveFlagPort = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return defaultDevServerPort
  const error = validateDevServerPort(value)
  if (error) fail(error)
  return Number(value)
}

export const hasSelectedFlags = (options: Record<string, any>): boolean => setupFlags.some((flag) => options[flag])
export const getSelectedFlagPackages = (options: Record<string, any>): string[] => packageFlags.filter((flag) => options[flag])
export const getSelectedFlagSetup = (options: Record<string, any>): string[] => setupFlags.filter((flag) => options[flag])
// feature flags (env, watch, bonjour, logscan) travel in selectedSetup, not here —
// listing them as folders made the preview promise src/ dirs that never exist
export const getSelectedFlagFolders = (_options: Record<string, any>): string[] => [...defaultFlagFolders]

export interface InteractivePromptsResult {
  selectedPackages: string[]
  selectedSetup: string[]
  selectedFolders: string[]
  shouldRunDevServer: boolean
  devServerPort: number
}

export const runInteractivePrompts = async (
  defaultPort: number = defaultDevServerPort
): Promise<InteractivePromptsResult> => {
  section('modules', 'select packages and project features')
  const selectedPackages = await customMultiselect({
    message: 'Select packages and modules to install:',
    options: packageOptions,
    initialValues: ['tailwind'],
  })

  section('structure', 'select optional src folders')
  const selectedFolders = await customMultiselect({
    message: 'Select optional src folders to scaffold:',
    options: folderOptions,
    initialValues: ['env', 'components', 'pages'],
  })

  section('bonjour service', 'configure mDNS local network service discovery')
  const shouldConfigureBonjour = await customConfirm({
    message: 'Configure Bonjour Discovery Service? (4b-react-mdns local network scanner)',
    initialValue: false,
  })

  section('custom log view', 'in-app console panel for browser logs')
  const shouldConfigureLogscan = await customConfirm({
    message: 'Add Custom Log View? (logscan floating in-app console panel)',
    initialValue: true,
  })

  section('dev server', 'choose the port the app runs on')
  const portAnswer = await customText({
    message: 'Which port should the dev server run on?',
    placeholder: String(defaultPort),
    defaultValue: String(defaultPort),
    validate: validateDevServerPort,
  })
  const devServerPort = Number(portAnswer)

  if (!(await isPortAvailable(devServerPort))) {
    warn(`port ${devServerPort} is already in use`, 'Vite will fall back to the next free port')
  }

  const shouldRunDevServer = await askToRunDevServer()
  const selectedFolderNames = selectedFolders.filter((value) => !folderFlags.includes(value))
  const selectedSetup = [
    ...selectedPackages,
    ...selectedFolders.filter((value) => folderFlags.includes(value)),
  ]

  if (shouldConfigureBonjour && !selectedSetup.includes('bonjour')) {
    selectedSetup.push('bonjour')
  }

  if (shouldConfigureLogscan && !selectedSetup.includes('logscan')) {
    selectedSetup.push('logscan')
  }

  return {
    selectedPackages: selectedPackages.filter((value) => packageFlags.includes(value)),
    selectedSetup,
    selectedFolders: selectedFolderNames,
    shouldRunDevServer,
    devServerPort,
  }
}

export const createSelectedFolders = async (projectPath: string, selectedFolders: string[]): Promise<void> => {
  for (const folder of selectedFolders) {
    // env / watch / bonjour / logscan are features, not folders — the flag path
    // passes them through here, so skip them instead of making empty src/ dirs
    if (folderFlags.includes(folder)) continue

    if (folder === 'assets') {
      await ensureDir(path.join(projectPath, 'public', 'images'))
      await ensureDir(path.join(projectPath, 'public', 'fonts'))
    } else {
      const folderPath = path.join(projectPath, 'src', folder)
      await ensureDir(folderPath)
    }
  }
}

export const createCustomFiles = async (projectPath: string, createdFiles: CustomCreatedFile[]): Promise<void> => {
  for (const file of createdFiles) {
    const folderPath = path.join(projectPath, 'src', file.folder)
    await ensureDir(folderPath)
    const filePath = path.join(folderPath, `${file.name}${file.ext}`)

    if (file.ext === '.jsx') {
      let jsxContent: string
      if (file.folder === 'components' && (file.name === 'Wrapper' || file.name === 'wrapper')) {
        jsxContent = `const Wrapper = ({ children }) => {
  return (
    <div className="min-h-screen w-full relative">
      {children}
    </div>
  );
};

export default Wrapper;
`
      } else if (file.folder === 'components' && (file.name === 'Loader' || file.name === 'loader')) {
        jsxContent = `const Loader = ({ text = 'Please wait...', className = '' }) => {
  return (
    <div className={\`flex flex-col items-center justify-center h-full w-full absolute inset-0 z-30 bg-[#060818]/80 backdrop-blur-sm \${className}\`}>
      {/* Loading Spinner */}
      <div className="w-[12vw] h-[12vw] max-w-14 max-h-14 border-4 border-white/20 border-t-[#1059DD] rounded-full animate-spin"></div>

      {/* Text */}
      {text && (
        <p className="text-white text-[1.1rem] font-poppins mt-4.5 tracking-wide">
          {text}
        </p>
      )}
    </div>
  )
}

export default Loader
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
  // logic goes here
}

export default ${file.name}
`
      await writeFile(filePath, jsContent)
    }
  }
}

export const configureFrontendWatch = async (projectPath: string): Promise<void> => {
  await copyFile(
    path.join(rootDir, 'templates', 'base', 'src', 'zecron-watch', 'client.js'),
    path.join(projectPath, 'src', 'zecron-watch', 'client.js'),
  )

  const mainPath = path.join(projectPath, 'src', 'main.jsx')
  if (!(await pathExists(mainPath))) return
  const content = await readFile(mainPath)
  if (content.includes('./zecron-watch/client.js') || content.includes("'./zecron-watch/client.js'")) return

  const watchImport = `
if (import.meta.env.DEV) {
  import('./zecron-watch/client.js')
}
`
  const appImport = "import App from './App.jsx'\n"
  if (content.includes(appImport)) {
    await writeFile(mainPath, content.replace(appImport, `${appImport}${watchImport}`))
    return
  }

  await writeFile(mainPath, `${content}\n${watchImport}`)
}

export const applyBaseTemplates = async (projectPath: string, selectedSetup: string[] = []): Promise<void> => {
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

export const deleteViteBoilerplate = async (projectPath: string): Promise<void> => {
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

  await ensureDir(path.join(projectPath, 'public'))
  await writeFile(path.join(projectPath, 'public', 'favicon.svg'), cliIconContent)
  await writeFile(path.join(projectPath, 'public', 'vite.svg'), cliIconContent)
}

const escapeHtml = (str: string): string =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

export const configureIndexHtml = async (projectPath: string, projectName: string): Promise<void> => {
  const indexHtmlPath = path.join(projectPath, 'index.html')
  if (await pathExists(indexHtmlPath)) {
    let content = await readFile(indexHtmlPath)

    const iconRegex = /<link\s+[^>]*href=["']\/?vite\.svg["'][^>]*\/?>/i
    if (iconRegex.test(content)) {
      content = content.replace(iconRegex, '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    } else if (!content.includes('href="/favicon.svg"')) {
      content = content.replace('</head>', '  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />\n</head>')
    }

    const cleanName = escapeHtml(projectName)
    const formattedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
    if (/<title>[\s\S]*?<\/title>/i.test(content)) {
      content = content.replace(/<title>[\s\S]*?<\/title>/i, `<title>${formattedTitle}</title>`)
    } else {
      content = content.replace('</head>', `  <title>${formattedTitle}</title>\n</head>`)
    }

    await writeFile(indexHtmlPath, content)
  }
}

export const postInstallHandlers: Record<string, (projectPath: string) => Promise<void>> = createPackageHandlers({ installPackages: false })

export const collectProjectEntries = (selectedFolders: string[], selectedSetup: string[]) => {
  const srcEntries = ['main.jsx', 'App.jsx']
  if (selectedSetup.includes('tailwind')) srcEntries.push('index.css')
  srcEntries.push(...selectedFolders.map((folder) => `${folder}/`))

  const rootEntries = ['public/', 'index.html', 'vite.config.js']
  if (selectedSetup.includes('env')) rootEntries.push('.env')
  rootEntries.push('package.json')

  return { srcEntries, rootEntries }
}

export interface ProjectPreviewParams {
  displayName: string
  selectedFolders: string[]
  selectedSetup: string[]
}

export const printProjectPreview = ({ displayName, selectedFolders, selectedSetup }: ProjectPreviewParams): void => {
  const { srcEntries, rootEntries } = collectProjectEntries(selectedFolders, selectedSetup)

  section('project')
  console.log(accent(`${displayName}/`))
  console.log(`${muted('├─')} ${accent('src/')}`)
  if (selectedSetup.includes('watch')) srcEntries.push('zecron-watch/')
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

export const createSetupSteps = (selectedPackages: string[], selectedSetup: string[]) => {
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

  if (selectedSetup.includes('bonjour')) {
    steps.push({
      pending: 'bonjour',
      active: 'configuring bonjour',
      done: 'bonjour',
      meta: 'mDNS discovery',
    })
  }

  if (selectedSetup.includes('logscan')) {
    steps.push({
      pending: 'log view',
      active: 'configuring log view',
      done: 'log view',
      meta: 'in-app console',
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

export const askToRunDevServer = async (): Promise<boolean> => {
  section('launch', 'start development server')
  return customConfirm({
    message: 'run npm run dev now?',
    initialValue: true,
  })
}

export interface SummaryParams {
  displayName: string
  selectedFolders: string[]
  selectedSetup: string[]
  commandTarget: string
}

export const printSummary = ({ displayName, selectedFolders, selectedSetup, commandTarget }: SummaryParams): void => {
  const folders = selectedFolders.length > 0 ? selectedFolders.join(', ') : 'none'
  const setup = selectedSetup.length > 0 ? selectedSetup.join(', ') : 'none'

  section('summary', 'configuration choices')
  console.log(`${muted('project')}     ${strong(displayName)}`)
  console.log(`${muted('target')}      ${strong(commandTarget === '.' ? process.cwd() : `~/${displayName}`)}`)
  console.log(`${muted('folders')}     ${chalk.white(folders)}`)
  console.log(`${muted('packages')}    ${chalk.white(setup)}`)
  console.log(`\n${accent('Done!')} Run ${chalk.bold.cyan(`cd ${displayName} && npm run dev`)} to start.`)
}

export const createProject = async (targetName?: string, options: Record<string, any> = {}): Promise<void> => {
  try {
    let rawTargetName = typeof targetName === 'string' && targetName.trim() ? targetName.trim() : ''
    let isCurrentDir = rawTargetName === '.'
    let currentDirName = path.basename(process.cwd())
    let commandTarget = isCurrentDir ? '.' : rawTargetName
    let displayName = isCurrentDir ? currentDirName : rawTargetName
    let projectPath = isCurrentDir ? process.cwd() : (rawTargetName ? path.join(process.cwd(), rawTargetName) : process.cwd())

    if (rawTargetName && !isCurrentDir) {
      validateProjectName(rawTargetName)
    }

    // validated on every path, so a bad --port fails before anything is created
    const requestedPort = resolveFlagPort(options.port)

    let selections: UiSelections
    if (options.ui) {
      selections = await startSetupWizardServer({ displayName: isCurrentDir ? '.' : displayName })
      if (selections && selections.projectName) {
        rawTargetName = selections.projectName
        isCurrentDir = rawTargetName === '.'
        commandTarget = isCurrentDir ? '.' : rawTargetName
        displayName = isCurrentDir ? currentDirName : rawTargetName
        projectPath = isCurrentDir ? process.cwd() : path.join(process.cwd(), rawTargetName)
        if (!isCurrentDir) {
          validateProjectName(rawTargetName)
        }
      } else if (!rawTargetName) {
        fail('Project name is required')
      }
    } else if (hasSelectedFlags(options)) {
      if (!rawTargetName) {
        fail('Please specify a project name (e.g. zecron my-app --tailwind)')
      }
      selections = {
        selectedPackages: getSelectedFlagPackages(options),
        selectedSetup: getSelectedFlagSetup(options),
        selectedFolders: getSelectedFlagFolders(options),
        shouldRunDevServer: false,
        devServerPort: requestedPort,
        createdFiles: [],
      }
    } else {
      if (!rawTargetName) {
        rawTargetName = '.'
        isCurrentDir = true
        commandTarget = '.'
        displayName = currentDirName
        projectPath = process.cwd()
      }
      const interactiveRes = await runInteractivePrompts(requestedPort)
      selections = {
        ...interactiveRes,
        createdFiles: [],
      }
    }

    const steps = createSetupSteps(selections.selectedPackages, selections.selectedSetup)
    const progress = createProgress(steps)
    progress.start()

    await progress.step(async () => {
      await createViteApp(commandTarget, projectPath)
      await deleteViteBoilerplate(projectPath)
      await configureIndexHtml(projectPath, displayName)
    })

    await progress.step(async () => {
      await createSelectedFolders(projectPath, selections.selectedFolders)
      await applyBaseTemplates(projectPath, selections.selectedSetup)
      if (selections.createdFiles && selections.createdFiles.length > 0) {
        await createCustomFiles(projectPath, selections.createdFiles)
      }
    })

    const packageMap: Record<string, string[]> = {
      tailwind: ['tailwindcss', '@tailwindcss/vite'],
      axios: ['axios'],
      socket: ['socket.io-client'],
      toast: ['ztoast'],
      icon: ['react-icons'],
      lucide: ['lucide-react'],
      router: ['react-router-dom'],
      qr: ['react-qr-code'],
      webcam: ['react-webcam'],
      printer: ['react-to-print'],
    }

    const batchPackages: string[] = []
    selections.selectedPackages.forEach((pkgName) => {
      const deps = packageMap[pkgName]
      if (deps) {
        deps.forEach((dep) => {
          if (!batchPackages.includes(dep)) batchPackages.push(dep)
        })
      }
    })

    if (selections.selectedSetup.includes('bonjour') && !batchPackages.includes(mdnsPackageName)) {
      batchPackages.push(mdnsPackageName)
    }

    if (selections.selectedSetup.includes('logscan') && !batchPackages.includes(logscanPackageSpec)) {
      batchPackages.push(logscanPackageSpec)
    }

    await progress.step(async () => {
      const pm = await detectPackageManager()
      if (batchPackages.length > 0) {
        let installArgs = ['install', ...batchPackages]
        if (pm === 'bun' || pm === 'pnpm' || pm === 'yarn') {
          installArgs = ['add', ...batchPackages]
        }
        await execa(pm, installArgs, { cwd: projectPath, reject: false })
      }
      await runCommand(pm, ['install'], { cwd: projectPath }, 'Failed to install project dependencies')
    })

    for (const packageName of selections.selectedPackages) {
      await progress.step(async () => {
        if (postInstallHandlers[packageName]) {
          await postInstallHandlers[packageName](projectPath)
        }
      })
    }

    if (selections.selectedSetup.includes('env')) {
      await progress.step(async () => {
        await configureEnv(projectPath)
      })
    } else {
      await ensureGitignoreWithEnv(projectPath)
    }

    if (selections.selectedSetup.includes('bonjour')) {
      await progress.step(async () => {
        await configureBonjourBoilerplate(projectPath)
      })
    }

    if (selections.selectedSetup.includes('logscan')) {
      await progress.step(async () => {
        await configureLogscan(projectPath)
      })
    }

    await progress.step(async () => {
      await setViteServerPort(projectPath, selections.devServerPort)
    })
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
        ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(selections.devServerPort)],
        { cwd: projectPath, stdio: 'inherit' },
        'Failed to run development server',
      )
    }
  } catch (error: any) {
    fail(error.message)
  }
}
