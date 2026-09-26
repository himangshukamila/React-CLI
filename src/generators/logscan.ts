import path from 'node:path'
import chalk from 'chalk'
import { section, pass, warn, fail, typeText } from '../ui/banner.js'
import { ensureDeps, readFile, writeFile, pathExists } from '../shared.js'

export const logscanPackageName = 'logscan'
// mountLogScanner, which the generated bootstrap relies on, first shipped in 0.5.0
export const logscanPackageSpec = 'logscan@^0.5.0'

const entryPointNames = ['src/main.jsx', 'src/main.tsx', 'src/index.jsx', 'src/index.tsx']

const findEntryPoint = async (projectRoot: string): Promise<string | null> => {
  for (const candidate of entryPointNames) {
    const fullPath = path.join(projectRoot, ...candidate.split('/'))
    if (await pathExists(fullPath)) return fullPath
  }
  return null
}

/**
 * The bootstrap written into the entry point.
 *
 * - mountLogScanner gives the panel its own React root, so it stays up when the
 *   app's root crashes — a <LogScanner /> rendered beside <App /> is unmounted
 *   along with it, at exactly the moment the logs matter most.
 * - Awaiting it before the render call means capture is running before the
 *   first render, so logs from initial renders and effects are not missed.
 * - import.meta.env.DEV is replaced at build time, so production drops the
 *   whole block and the package with it (a static import adds ~59KB of JS).
 * - A failure here must never stop the app from rendering, hence the catch.
 */
export const logscanBootstrap =
  `// Custom Log View (logscan): a floating console panel for development.\n` +
  `// It mounts in its own React root, so it stays up if the app crashes, and\n` +
  `// starting it before the render call captures logs from the first render.\n` +
  `// import.meta.env.DEV is replaced at build time, so production drops it.\n` +
  `if (import.meta.env.DEV) {\n` +
  `  try {\n` +
  `    const { mountLogScanner } = await import('${logscanPackageName}')\n` +
  `    const scanner = mountLogScanner({ visible: true })\n` +
  `    import.meta.hot?.dispose(() => scanner.dispose())\n` +
  `  } catch (error) {\n` +
  `    console.warn('[logscan] Custom Log View could not start (needs logscan >= 0.5.0):', error)\n` +
  `  }\n` +
  `}\n\n`

/**
 * Insert the logscan bootstrap into an entry file. The render call itself is
 * left untouched, so this composes with anything else that wraps the tree.
 */
export const addLogscanBootstrap = (entry: string): { source: string; status: 'added' | 'present' | 'legacy' } => {
  if (entry.includes('mountLogScanner')) return { source: entry, status: 'present' }
  // logscan warns against mounting both integrations in one app
  if (entry.includes('LogScanner')) return { source: entry, status: 'legacy' }

  const renderAt = entry.lastIndexOf('.render(')
  if (renderAt === -1) {
    // no render call to go before; it still works from the end, just starts later
    const separator = entry.endsWith('\n') ? '\n' : '\n\n'
    return { source: `${entry}${separator}${logscanBootstrap.trimEnd()}\n`, status: 'added' }
  }

  const statementAt = entry.lastIndexOf('\n', renderAt) + 1
  return {
    source: entry.slice(0, statementAt) + logscanBootstrap + entry.slice(statementAt),
    status: 'added',
  }
}

/**
 * Start logscan's standalone viewer from the entry point, so the panel is
 * available everywhere without touching a single component. Browser capture
 * only — the Node adapter is a separate, server-side install.
 */
export const configureLogscan = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    section('custom log view', 'wiring the logscan in-app console panel')

    const installed = await ensureDeps(projectPath, [logscanPackageSpec])
    if (installed.length > 0) pass(`installed ${installed.join(', ')}`)

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
        '\n✅ Custom Log View wired through logscan!\n' +
          '   Keep using console.log / warn / error — fetch and XHR calls show up too.\n' +
          '   It runs in its own root so it outlives an app crash, and only loads in dev.'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
