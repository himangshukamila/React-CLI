import chalk from 'chalk'
import { execa } from 'execa'
import { section, pass, fail, accent, muted, typeText } from '../ui/banner.js'
import { readCurrentPackageJson } from '../shared.js'

export interface OutdatedPackageInfo {
  current?: string
  wanted?: string
  latest?: string
}

export const checkUpdates = async (): Promise<void> => {
  try {
    await readCurrentPackageJson()
    section('update', 'read-only dependency check')

    let result
    try {
      result = await execa('npm', ['outdated', '--json'], {
        cwd: process.cwd(),
        reject: false,
      })
    } catch (error: any) {
      throw new Error(`Could not check outdated packages: ${error.shortMessage || error.message}`)
    }

    if (![0, 1].includes(result.exitCode)) {
      throw new Error(result.stderr || 'npm outdated failed')
    }

    const raw = result.stdout.trim()
    const outdated: Record<string, OutdatedPackageInfo> = raw ? JSON.parse(raw) : {}
    const entries = Object.entries(outdated)

    if (entries.length === 0) {
      pass('All dependencies are up to date')
      await typeText(muted('No packages were installed or changed.'))
      return
    }

    const nameWidth = Math.max('package'.length, ...entries.map(([name]) => name.length)) + 2
    const currentWidth = Math.max('current'.length, ...entries.map(([, info]) => String(info.current || '-').length)) + 2
    const wantedWidth = Math.max('wanted'.length, ...entries.map(([, info]) => String(info.wanted || '-').length)) + 2

    await typeText(
      `${muted('package'.padEnd(nameWidth))}${muted('current'.padEnd(currentWidth))}${muted('wanted'.padEnd(wantedWidth))}${muted('latest')}`,
    )

    for (const [name, info] of entries) {
      const current = String(info.current || '-')
      const wanted = String(info.wanted || '-')
      const latest = String(info.latest || '-')
      await typeText(
        `${accent(name.padEnd(nameWidth))}${chalk.white(current.padEnd(currentWidth))}${chalk.white(wanted.padEnd(wantedWidth))}${chalk.hex('#10B981').bold(latest)}`,
      )
    }

    await typeText(`\n${muted('No packages were installed or changed.')}`)
  } catch (error: any) {
    fail(error.message)
  }
}
