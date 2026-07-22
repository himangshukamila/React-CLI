import path from 'node:path'
import chalk from 'chalk'
import { section, pass, warn, fail, muted, strong } from '../ui/banner.js'
import { pathExists, readCurrentPackageJson, getDependencies, readTextIfExists, readFile, runCommand } from '../shared.js'

export const doctor = async () => {
  try {
    section('doctor', 'project health check')

    console.log(`${muted('node')}     ${strong(process.version)}`)

    try {
      const npmVersion = await runCommand('npm', ['--version'], { stdio: 'pipe' }, 'Could not read npm version')
      console.log(`${muted('npm')}      ${strong(npmVersion.stdout)}`)
    } catch (error) {
      warn('npm check failed', error.message)
    }

    const packageJsonPath = path.join(process.cwd(), 'package.json')
    if (!(await pathExists(packageJsonPath))) {
      warn('package.json missing', 'run this inside a React project')
      return
    }

    pass('package.json found')

    const packageJson = await readCurrentPackageJson()
    const dependencies = getDependencies(packageJson)

    if (dependencies.react) pass('React installed', dependencies.react)
    else warn('React missing')

    if (dependencies.vite) pass('Vite installed', dependencies.vite)
    else warn('Vite missing')

    const mainPath = path.join(process.cwd(), 'src', 'main.jsx')
    const appPath = path.join(process.cwd(), 'src', 'App.jsx')
    const viteConfigPath = path.join(process.cwd(), 'vite.config.js')
    const envPath = path.join(process.cwd(), '.env')

    if (await pathExists(mainPath)) pass('src/main.jsx found')
    else warn('src/main.jsx missing')

    if (await pathExists(appPath)) pass('src/App.jsx found')
    else warn('src/App.jsx missing')

    if (await pathExists(viteConfigPath)) pass('vite.config.js found')
    else warn('vite.config.js missing')

    if (await pathExists(envPath)) {
      pass('.env found')
      const envContent = await readFile(envPath)
      ;['VITE_SERVER_URL'].forEach((key) => {
        if (envContent.includes(`${key}=`)) pass(`${key} set`)
        else warn(`${key} missing`)
      })
    } else {
      warn('.env missing', 'run react-setup env add VITE_SERVER_URL http://localhost:3000')
    }

    if (dependencies.tailwindcss || dependencies['@tailwindcss/vite']) {
      const viteConfig = await readTextIfExists(viteConfigPath)
      const indexCss = await readTextIfExists(path.join(process.cwd(), 'src', 'index.css'))

      if (dependencies.tailwindcss) pass('Tailwind installed', dependencies.tailwindcss)
      else warn('tailwindcss missing')

      if (dependencies['@tailwindcss/vite']) pass('@tailwindcss/vite installed', dependencies['@tailwindcss/vite'])
      else warn('@tailwindcss/vite missing')

      if (viteConfig.includes('@tailwindcss/vite')) pass('Vite Tailwind plugin configured')
      else warn('Vite Tailwind plugin missing from vite.config.js')

      if (indexCss.includes('@import "tailwindcss";')) pass('Tailwind v4 import set in src/index.css')
      else warn('@import "tailwindcss"; missing in src/index.css')
    }
  } catch (error) {
    fail(error.message)
  }
}
