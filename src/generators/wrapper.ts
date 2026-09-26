import path from 'node:path'
import chalk from 'chalk'
import { section, pass, fail, typeText } from '../ui/banner.js'
import { ensureDir, wrapperContent } from '../shared.js'
import { writeGenerated } from './safeWrite.js'

// configure wrapper component in src/components
export const configureWrapper = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    section('wrapper generator', 'building Wrapper.jsx with dynamic bg prop and fullscreen layout')

    const componentsDir = path.join(projectPath, 'src', 'components')
    await ensureDir(componentsDir)

    const written = await writeGenerated(
      path.join(componentsDir, 'Wrapper.jsx'),
      wrapperContent,
      { projectRoot: projectPath }
    )

    if (!written) return

    pass('created src/components/Wrapper.jsx')
    await typeText(
      chalk.green.bold(
        '\n✅ src/components/Wrapper.jsx created with dynamic bg and children props,\n' +
          '   ready to wrap pages in full-screen cover background layouts!'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
