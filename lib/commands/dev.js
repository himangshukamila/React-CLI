import { execa } from 'execa'
import { section, fail } from '../ui/banner.js'
import { readCurrentPackageJson, assertDevScript, validatePort, runCommand } from '../shared.js'

export const runDevServer = async (portOption, options = {}) => {
  try {
    const packageJson = await readCurrentPackageJson()
    await assertDevScript(packageJson)

    const args = ['run', 'dev', '--', '--host', '0.0.0.0']
    const port = validatePort(portOption)
    if (port) args.push('--port', port)

    if (options.f) {
      const devPort = port || '5173'
      const devUrl = `http://localhost:${devPort}`
      setTimeout(() => {
        execa('open', ['-a', 'Firefox Developer Edition', devUrl]).catch(() => {})
      }, 1000)
    }

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
