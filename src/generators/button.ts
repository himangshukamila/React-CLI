import path from 'node:path'
import chalk from 'chalk'
import { section, pass, fail, typeText } from '../ui/banner.js'
import { ensureDir, buttonContent } from '../shared.js'
import { writeGenerated } from './safeWrite.js'

// configure simple button component in src/components
export const configureButton = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    section('button generator', 'building simple Button.jsx component')

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
        '\n✅ src/components/Button.jsx created with simple height, width, font, text size, color, icon, position, and click handlers!'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}

