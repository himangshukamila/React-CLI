import path from 'node:path'
import chalk from 'chalk'
import { section, pass, fail, typeText } from '../ui/banner.js'
import { ensureDir, ensureDeps, buttonContent } from '../shared.js'
import { writeGenerated } from './safeWrite.js'

export const configureButton = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    section('button generator', 'building Button.jsx with variants, sizes and loading state')

    const installed = await ensureDeps(projectPath, ['lucide-react'])
    if (installed.length > 0) pass(`installed ${installed.join(', ')}`)

    const componentsDir = path.join(projectPath, 'src', 'components')
    await ensureDir(componentsDir)

    const written = await writeGenerated(
      path.join(componentsDir, 'Button.jsx'),
      buttonContent,
      { projectRoot: projectPath }
    )

    if (!written) return

    pass('created src/components/Button.jsx')
    await typeText(
      chalk.green.bold(
        '\n✅ src/components/Button.jsx created with variants, sizes and loading state,\n' +
          '   plus variants / sizes / spinner props to override any of it at the call site!'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
