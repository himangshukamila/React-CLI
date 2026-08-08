import path from 'node:path'
import chalk from 'chalk'
import { section, pass, fail, typeText } from '../ui/banner.js'
import { ensureDir, writeFile, pathExists } from '../shared.js'

export const configureLoaderBoilerplate = async (): Promise<void> => {
  try {
    const pkgJsonPath = path.join(process.cwd(), 'package.json')
    if (!(await pathExists(pkgJsonPath))) {
      throw new Error('Not inside a React project. Run this from your app folder.')
    }

    const componentsDir = path.join(process.cwd(), 'src', 'components')
    const loaderJsxPath = path.join(componentsDir, 'Loader.jsx')

    section('loader generator', 'building styled backdrop Loader.jsx component')

    await ensureDir(componentsDir)

    const loaderJsxContent = `const Loader = ({ text = 'Please wait...', className = '' }) => {
  return (
    <div className={\`flex flex-col items-center justify-center h-full w-full absolute inset-0 z-30 bg-[#060818]/80 backdrop-blur-sm \${className}\`}>
      {/* Loading Spinner */}
      <div className="w-[12vw] h-[12vw] max-w-14 max-h-14 border-4 border-white/20 border-t-[#1059DD] rounded-full animate-spin"></div>

      {/* Text */}
      {text && (
        <p className="text-white text-[1.1rem] font-poppins mt-4.5 tracking-wide">
          {text}
        </p>
      )}
    </div>
  )
}

export default Loader
`

    await writeFile(loaderJsxPath, loaderJsxContent)

    pass('created src/components/Loader.jsx')
    await typeText(chalk.green.bold('\n✅ src/components/Loader.jsx successfully created with backdrop blur spinner and prop text support!'))
  } catch (error: any) {
    fail(error.message)
  }
}
