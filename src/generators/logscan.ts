import path from 'node:path'
import chalk from 'chalk'
import { section, pass, warn, fail, typeText } from '../ui/banner.js'
import { ensureDeps, readFile, writeFile, pathExists } from '../shared.js'

export const logscanPackageName = 'logscan'

const entryPointNames = ['src/main.jsx', 'src/main.tsx', 'src/index.jsx', 'src/index.tsx']

const findEntryPoint = async (projectRoot: string): Promise<string | null> => {
  for (const candidate of entryPointNames) {
    const fullPath = path.join(projectRoot, ...candidate.split('/'))
    if (await pathExists(fullPath)) return fullPath
  }
  return null
}

/**
 * Mount <LogScanner /> next to whatever the entry point already renders, so the
 * panel is available everywhere without touching a single component. Browser
 * capture only — the Node adapter is a separate, server-side install.
 */
export const configureLogscan = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    section('custom log view', 'wiring the logscan in-app console panel')

    const installed = await ensureDeps(projectPath, [logscanPackageName])
    if (installed.length > 0) pass(`installed ${logscanPackageName}`)

    const entryPath = await findEntryPoint(projectPath)
    if (!entryPath) {
      warn('no entry point found', `render <LogScanner /> from ${logscanPackageName} yourself`)
      return
    }

    const entry = await readFile(entryPath)
    if (entry.includes('LogScanner')) {
      pass(`<LogScanner /> already mounted in ${path.basename(entryPath)}`)
      return
    }

    const renderAt = entry.lastIndexOf('.render(')
    const openAt = renderAt === -1 ? -1 : entry.indexOf('(', renderAt)
    let closeAt = -1
    let depth = 0
    for (let index = openAt; index > -1 && index < entry.length; index += 1) {
      const char = entry[index]
      if (char === '(') depth += 1
      else if (char === ')') {
        depth -= 1
        if (depth === 0) {
          closeAt = index
          break
        }
      }
    }

    if (closeAt === -1) {
      warn(
        `could not wrap ${path.basename(entryPath)}`,
        'render <LogScanner visible={import.meta.env.DEV} /> beside your app yourself'
      )
      return
    }

    const rendered = entry.slice(openAt + 1, closeAt).trim().replace(/,$/, '').trim()
    // the existing tree moves one level deeper inside the fragment
    const indented = rendered.split('\n').join('\n  ')

    // The panel never renders in production, but a plain static import still
    // bundles it there — ~45KB of JS plus a ~930KB logo. import.meta.env.DEV is
    // replaced at build time, so a guarded lazy() lets the bundler drop both.
    const declaration =
      `// dev only: import.meta.env.DEV is replaced at build time, so the panel\n` +
      `// and its assets are dropped from production bundles entirely\n` +
      `const LogScanner = import.meta.env.DEV\n` +
      `  ? lazy(() => import('${logscanPackageName}').then((module) => ({ default: module.LogScanner })))\n` +
      `  : null\n\n`

    const statementAt = entry.lastIndexOf('\n', renderAt) + 1

    const wrapped =
      `import { Suspense, lazy } from 'react'\n` +
      entry.slice(0, statementAt) +
      declaration +
      entry.slice(statementAt, openAt + 1) +
      `\n  <>\n    ${indented}\n` +
      `    {LogScanner && (\n` +
      `      <Suspense fallback={null}>\n` +
      `        <LogScanner visible />\n` +
      `      </Suspense>\n` +
      `    )}\n  </>,\n` +
      entry.slice(closeAt)

    await writeFile(entryPath, wrapped)
    pass(`mounted <LogScanner /> in ${path.basename(entryPath)}`)

    await typeText(
      chalk.green.bold(
        '\n✅ Custom Log View wired through logscan!\n' +
          '   Keep using console.log / warn / error — the floating panel mirrors them in the app.\n' +
          '   It is lazy loaded behind import.meta.env.DEV, so production bundles drop it entirely.'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
