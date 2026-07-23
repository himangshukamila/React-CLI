import path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
import { section, pass, warn, fail, accent, muted, strong } from '../ui/banner.js'
import { packageFlags, setupFlags, defaultFlagFolders, folderFlags, packageOptions, folderOptions } from '../ui/banner.js'
import { createProgress, customMultiselect, customConfirm } from '../ui/prompts.js'
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
  runPackageInstall,
  ensureGitignoreWithEnv,
  configureEnv,
  createPackageHandlers,
  runCommand,
  cliIconContent,
  projectNameRegex,
} from '../shared.js'
import { startSetupWizardServer } from '../commands/wizard.js'

export const validateProjectName = (name) => {
  if (!projectNameRegex.test(name) || name.includes('..') || name.includes('/')) {
    fail('Invalid project name')
  }
}

export const hasSelectedFlags = (options) => setupFlags.some((flag) => options[flag])
export const getSelectedFlagPackages = (options) => packageFlags.filter((flag) => options[flag])
export const getSelectedFlagSetup = (options) => setupFlags.filter((flag) => options[flag])
export const getSelectedFlagFolders = (options) => [...defaultFlagFolders, ...folderFlags.filter((flag) => options[flag])]

export const runInteractivePrompts = async () => {
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

export const createSelectedFolders = async (projectPath, selectedFolders) => {
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

export const createCustomFiles = async (projectPath, createdFiles) => {
  for (const file of createdFiles) {
    const folderPath = path.join(projectPath, 'src', file.folder)
    await ensureDir(folderPath)
    const filePath = path.join(folderPath, `${file.name}${file.ext}`)

    if (file.ext === '.jsx') {
      let jsxContent
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

export const configureFrontendWatch = async (projectPath) => {
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

export const applyBaseTemplates = async (projectPath, selectedSetup = []) => {
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

export const deleteViteBoilerplate = async (projectPath) => {
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

export const configureIndexHtml = async (projectPath, projectName) => {
  const indexHtmlPath = path.join(projectPath, 'index.html')
  if (await pathExists(indexHtmlPath)) {
    let content = await readFile(indexHtmlPath)
    
    const iconRegex = /<link\s+[^>]*href=["']\/?vite\.svg["'][^>]*\/?>/i
    if (iconRegex.test(content)) {
      content = content.replace(iconRegex, '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    } else if (!content.includes('href="/favicon.svg"')) {
      content = content.replace('</head>', '  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />\n</head>')
    }
    
    const formattedTitle = projectName.charAt(0).toUpperCase() + projectName.slice(1)
    if (/<title>[\s\S]*?<\/title>/i.test(content)) {
      content = content.replace(/<title>[\s\S]*?<\/title>/i, `<title>${formattedTitle}</title>`)
    } else {
      content = content.replace('</head>', `  <title>${formattedTitle}</title>\n</head>`)
    }
    
    await writeFile(indexHtmlPath, content)
  }
}

export const postInstallHandlers = createPackageHandlers({ installPackages: false })

export const collectProjectEntries = (selectedFolders, selectedSetup) => {
  const srcEntries = ['main.jsx', 'App.jsx']
  if (selectedSetup.includes('tailwind')) srcEntries.push('index.css')
  srcEntries.push(...selectedFolders.map((folder) => `${folder}/`))

  const rootEntries = ['public/', 'index.html', 'vite.config.js']
  if (selectedSetup.includes('env')) rootEntries.push('.env')
  rootEntries.push('package.json')

  return { srcEntries, rootEntries }
}

export const printProjectPreview = ({ displayName, selectedFolders, selectedSetup }) => {
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

export const createSetupSteps = (selectedPackages, selectedSetup) => {
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

export const askToRunDevServer = async () => {
  section('launch', 'start development server')
  return customConfirm({
    message: 'run npm run dev now?',
    initialValue: true,
  })
}

export const printSummary = ({ displayName, selectedFolders, selectedSetup, commandTarget }) => {
  const folders = selectedFolders.length > 0 ? selectedFolders.join(', ') : 'none'
  const setup = selectedSetup.length > 0 ? selectedSetup.join(', ') : 'none'

  section('summary', 'configuration choices')
  console.log(`${muted('project')}     ${strong(displayName)}`)
  console.log(`${muted('target')}      ${strong(commandTarget === '.' ? process.cwd() : `~/${displayName}`)}`)
  console.log(`${muted('folders')}     ${chalk.white(folders)}`)
  console.log(`${muted('packages')}    ${chalk.white(setup)}`)
  console.log(`\n${accent('Done!')} Run ${chalk.bold.cyan(`cd ${displayName} && npm run dev`)} to start.`)
}

export const createProject = async (targetName, options = {}) => {
  try {
    const rawTargetName = typeof targetName === 'string' ? targetName : '.'
    const isCurrentDir = rawTargetName === '.'
    const currentDirName = path.basename(process.cwd())
    const commandTarget = isCurrentDir ? '.' : rawTargetName
    const displayName = isCurrentDir ? currentDirName : rawTargetName
    const projectPath = isCurrentDir ? process.cwd() : path.join(process.cwd(), rawTargetName)

    if (!isCurrentDir) {
      validateProjectName(rawTargetName)
    }

    let selections
    if (options.ui) {
      selections = await startSetupWizardServer({ displayName })
    } else if (hasSelectedFlags(options)) {
      selections = {
        selectedPackages: getSelectedFlagPackages(options),
        selectedSetup: getSelectedFlagSetup(options),
        selectedFolders: getSelectedFlagFolders(options),
        shouldRunDevServer: false,
      }
    } else {
      selections = await runInteractivePrompts()
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

    const packageMap = {
      tailwind: ['tailwindcss', '@tailwindcss/vite'],
      axios: ['axios'],
      socket: ['socket.io-client'],
      toast: ['react-hot-toast'],
      icon: ['react-icons'],
      lucide: ['lucide-react'],
      router: ['react-router-dom'],
      qr: ['react-qr-code'],
      webcam: ['react-webcam'],
      printer: ['react-to-print'],
    }

    const batchPackages = []
    selections.selectedPackages.forEach((pkgName) => {
      const deps = packageMap[pkgName]
      if (deps) {
        deps.forEach((dep) => {
          if (!batchPackages.includes(dep)) batchPackages.push(dep)
        })
      }
    })

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
        await postInstallHandlers[packageName](projectPath)
      })
    }

    if (selections.selectedSetup.includes('env')) {
      await progress.step(async () => {
        await configureEnv(projectPath)
      })
    } else {
      await ensureGitignoreWithEnv(projectPath)
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
