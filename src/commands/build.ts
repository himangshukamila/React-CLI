import path from 'node:path'
import chalk from 'chalk'
import { section, fail, typeText } from '../ui/banner.js'
import { readCurrentPackageJson, runCommand, pathExists } from '../shared.js'

export interface BuildOptions {
  open?: boolean
}

export const runBuild = async (action?: string, options: BuildOptions = {}): Promise<void> => {
  try {
    await readCurrentPackageJson()
    const isOpenRequested = action === 'open' || Boolean(options.open)

    section('build', 'npm run build')

    await typeText(
      `${chalk.hex('#00E5FF')('⚡ building')}   ${chalk.bold.whiteBright('Production Bundle')} ${chalk.hex('#94A3B8')('(vite build)')}...`,
      12,
    )

    const startTime = Date.now()

    await runCommand(
      'npm',
      ['run', 'build'],
      { cwd: process.cwd(), stdio: 'inherit' },
      'Production build failed',
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    await typeText(
      `\n${chalk.hex('#10B981').bold('✅ Production build completed successfully')} ${chalk.hex('#38BDF8')(`in ${duration}s`)} ${chalk.hex('#94A3B8')('(dist/ ready)')} ✓`,
      12,
    )

    if (isOpenRequested) {
      await typeText(
        `\n${chalk.hex('#EC4899')('↗ launching')}  ${chalk.bold.whiteBright('Production Preview Server')} ${chalk.hex('#94A3B8')('(npm run preview)')}...\n`,
        12,
      )

      await runCommand(
        'npm',
        ['run', 'preview'],
        { cwd: process.cwd(), stdio: 'inherit' },
        'Failed to launch preview server',
      )
    }
  } catch (error: any) {
    fail(error.message)
  }
}

export const runPreview = async (): Promise<void> => {
  try {
    await readCurrentPackageJson()

    const distPath = path.join(process.cwd(), 'dist')
    if (!(await pathExists(distPath))) {
      fail('No build output found in dist/. Please run build first.')
    }

    section('preview', 'npm run preview')

    await typeText(
      `${chalk.hex('#EC4899')('↗ launching')}  ${chalk.bold.whiteBright('Production Preview Server')} ${chalk.hex('#94A3B8')('(npm run preview)')}...\n`,
      12,
    )

    await runCommand(
      'npm',
      ['run', 'preview'],
      { cwd: process.cwd(), stdio: 'inherit' },
      'Failed to launch preview server',
    )
  } catch (error: any) {
    fail(error.message)
  }
}
