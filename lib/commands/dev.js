import { execa } from 'execa'
import chalk from 'chalk'
import { section, fail, typeText } from '../ui/banner.js'
import { readCurrentPackageJson, assertDevScript, validatePort, runCommand } from '../shared.js'

export const runDevServer = async (portOption, options = {}) => {
  try {
    const packageJson = await readCurrentPackageJson()
    await assertDevScript(packageJson)

    const args = ['run', 'dev', '--', '--host', '0.0.0.0']
    const port = validatePort(portOption)
    if (port) args.push('--port', port)

    const devPort = port || '5173'
    const devUrl = `http://localhost:${devPort}`

    section('run', port ? `npm run dev -- --host 0.0.0.0 --port ${port}` : 'npm run dev -- --host 0.0.0.0')

    await typeText(`${chalk.hex('#EC4899')('⚡ launching')}  ${chalk.bold.whiteBright('Vite Dev Server')} ${chalk.hex('#38BDF8')(`(host: 0.0.0.0${port ? `, port: ${port}` : ''})`)}...`)

    if (options.f) {
      await typeText(`${chalk.hex('#F59E0B')('↗ opening')}    ${chalk.bold.yellowBright('Firefox Developer Edition')} ${chalk.hex('#94A3B8')(`(${devUrl})`)}...`)
      setTimeout(() => {
        execa('open', ['-a', 'Firefox Developer Edition', devUrl]).catch(() => {})
      }, 1000)
    }

    await typeText(`${chalk.hex('#10B981').bold('✅ dev server starting')} ${chalk.hex('#94A3B8')('(Press Ctrl+C to stop)')}\n`)

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
