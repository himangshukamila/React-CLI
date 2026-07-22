import chalk from 'chalk'
import { execa } from 'execa'
import { section, pass, fail, accent, muted } from '../ui/banner.js'
import { readCurrentPackageJson } from '../shared.js'

export const checkUpdates = async () => {
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
