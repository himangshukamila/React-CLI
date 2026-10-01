import path from 'node:path'
import chalk from 'chalk'
import { section, pass, warn, fail, typeText } from '../ui/banner.js'
import {
  ensureDeps,
  readFile,
  writeFile,
  pathExists,
  runPackageUninstall,
  readProjectPackageJson,
} from '../shared.js'

export const logscanPackageName = 'logscan'
// mountlogscanner, which the generated bootstrap relies on, first shipped in 0.5.0
export const logscanPackageSpec = 'logscan@^0.5.0'

const entryPointNames = ['src/main.jsx', 'src/main.tsx', 'src/index.jsx', 'src/index.tsx']

const findEntryPoint = async (projectRoot: string): Promise<string | null> => {
  for (const candidate of entryPointNames) {
    const fullPath = path.join(projectRoot, ...candidate.split('/'))
    if (await pathExists(fullPath)) return fullPath
  }
  return null
}

// custom log view (logscan): a floating console panel for development
export const logscanBootstrap =
  `// custom log view (logscan): a floating console panel for development\n` +
  `// it mounts in its own react root, so it stays up if the app crashes, and\n` +
  `// starting it before the render call captures logs from the first render\n` +
  `// import.meta.env.DEV is replaced at build time, so production drops it\n` +
  `if (import.meta.env.DEV) {\n` +
  `  try {\n` +
  `    const { mountLogScanner } = await import('${logscanPackageName}')\n` +
  `    const scanner = mountLogScanner({ visible: true })\n` +
  `    import.meta.hot?.dispose(() => scanner.dispose())\n` +
  `  } catch (error) {\n` +
  `    console.warn('[logscan] custom log view could not start (needs logscan >= 0.5.0):', error)\n` +
  `  }\n` +
  `}\n\n`

// insert the logscan bootstrap into an entry file
export const addLogscanBootstrap = (entry: string): { source: string; status: 'added' | 'present' | 'legacy' } => {
  if (entry.includes('mountLogScanner')) return { source: entry, status: 'present' }
  // logscan warns against mounting both integrations in one app
  if (entry.includes('LogScanner')) return { source: entry, status: 'legacy' }

  const renderAt = entry.lastIndexOf('.render(')
  if (renderAt === -1) {
    // no render call to go before, it still works from the end, just starts later
    const separator = entry.endsWith('\n') ? '\n' : '\n\n'
    return { source: `${entry}${separator}${logscanBootstrap.trimEnd()}\n`, status: 'added' }
  }

  const statementAt = entry.lastIndexOf('\n', renderAt) + 1
  return {
    source: entry.slice(0, statementAt) + logscanBootstrap + entry.slice(statementAt),
    status: 'added',
  }
}

// remove logscan bootstrap and any legacy mounts from an entry file
export const removeLogscanBootstrap = (
  entry: string
): { source: string; status: 'removed' | 'absent' } => {
  let cleaned = entry

  // remove dynamic dev bootstrap block and any directly preceding comments
  const logscanBlockRegex = /(?:\/\/[^\n]*\n)*\s*if\s*\(\s*import\.meta\.env\.DEV\s*\)\s*\{[\s\S]*?mountLogScanner[\s\S]*?\n\}\s*\n?/g
  cleaned = cleaned.replace(logscanBlockRegex, '')

  // remove any static logscan imports or legacy component mounts
  const logscanImportRegex = /^import[^\n]*['"]logscan['"][^\n]*\r?\n?/gm
  cleaned = cleaned.replace(logscanImportRegex, '')

  const logscanLegacyComponentRegex = /<LogScanner\s*\/?>\s*/g
  cleaned = cleaned.replace(logscanLegacyComponentRegex, '')

  // collapse any resulting consecutive newlines into at most two
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  if (cleaned === entry) {
    return { source: entry, status: 'absent' }
  }

  return { source: cleaned, status: 'removed' }
}

// start logscans standalone viewer from the entry point as a dev dependency
export const configureLogscan = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    section('custom log view', 'wiring the logscan in-app console panel')

    const installed = await ensureDeps(projectPath, [logscanPackageSpec], { dev: true })
    if (installed.length > 0) pass(`installed ${installed.join(', ')} as devDependency`)

    const entryPath = await findEntryPoint(projectPath)
    if (!entryPath) {
      warn('no entry point found', `call mountLogScanner() from ${logscanPackageName} in your entry file`)
      return
    }

    const entryName = path.basename(entryPath)
    const { source, status } = addLogscanBootstrap(await readFile(entryPath))

    if (status === 'present') {
      pass(`logscan already starts from ${entryName}`)
      return
    }

    if (status === 'legacy') {
      warn(
        `${entryName} already renders <LogScanner />`,
        'left as is — switch it to mountLogScanner() so the panel survives app crashes'
      )
      return
    }

    await writeFile(entryPath, source)
    pass(`started logscan from ${entryName}`)

    await typeText(
      chalk.green.bold(
        '\n✅ Custom Log View wired through logscan (devDependency)!\n' +
          '   Keep using console.log / warn / error — fetch and XHR calls show up too.\n' +
          '   It runs in its own root so it outlives an app crash, and only loads in dev.'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}

// remove logscan code from entry file and uninstall package
export const removeLogscan = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    section('remove logscan', 'removing logscan code and library')

    const entryPath = await findEntryPoint(projectPath)
    if (entryPath) {
      const entryName = path.basename(entryPath)
      const currentSource = await readFile(entryPath)
      const { source, status } = removeLogscanBootstrap(currentSource)

      if (status === 'removed') {
        await writeFile(entryPath, source)
        pass(`removed logscan bootstrap from ${entryName}`)
      } else {
        pass(`no logscan bootstrap found in ${entryName}`)
      }
    }

    const pkgJson = await readProjectPackageJson(projectPath)
    const hasLogscanDep = Boolean(
      pkgJson.dependencies?.[logscanPackageName] ||
      pkgJson.devDependencies?.[logscanPackageName]
    )

    if (hasLogscanDep) {
      // ensure package.json is cleaned up
      if (pkgJson.dependencies?.[logscanPackageName]) {
        delete pkgJson.dependencies[logscanPackageName]
      }
      if (pkgJson.devDependencies?.[logscanPackageName]) {
        delete pkgJson.devDependencies[logscanPackageName]
      }
      await writeFile(path.join(projectPath, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n')

      // attempt package manager uninstall to prune lockfile and node modules
      try {
        await runPackageUninstall([logscanPackageName], { cwd: projectPath }, `Failed to uninstall ${logscanPackageName}`)
        pass(`uninstalled ${logscanPackageName} package`)
      } catch {
        pass(`removed ${logscanPackageName} from package.json`)
      }
    } else {
      pass(`${logscanPackageName} is not installed in dependencies`)
    }

    await typeText(
      chalk.green.bold(
        '\n✅ Successfully removed logscan code and library!\n'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
