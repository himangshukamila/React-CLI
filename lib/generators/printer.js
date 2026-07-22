import path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
import fs from 'fs-extra'
import { section, pass, fail, typeText } from '../ui/banner.js'
import { ensureDir, writeFile, socketContent, printerContent } from '../shared.js'

export const configurePrinterBoilerplate = async () => {
  try {
    const pkgJsonPath = path.join(process.cwd(), 'package.json')
    if (!await fs.pathExists(pkgJsonPath)) {
      throw new Error('Not inside a React project. Run this from your app folder.')
    }
    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8'))

    const allDeps = {
      ...(pkgJson.dependencies || {}),
      ...(pkgJson.devDependencies || {}),
    }

    if (!allDeps['react-to-print']) {
      console.log(chalk.yellow('Installing missing dependency: react-to-print...'))
      await execa('npm', ['install', 'react-to-print'], { cwd: process.cwd() })
      pass('installed react-to-print')
    }

    if (!allDeps['socket.io-client']) {
      console.log(chalk.yellow('Installing missing dependency: socket.io-client...'))
      await execa('npm', ['install', 'socket.io-client'], { cwd: process.cwd() })
      pass('installed socket.io-client')
    }

    const servicesDir = path.join(process.cwd(), 'src', 'services')
    const socketPath = path.join(servicesDir, 'socket.js')
    if (!await fs.pathExists(socketPath)) {
      await ensureDir(servicesDir)
      await writeFile(socketPath, socketContent)
      pass('created src/services/socket.js')
    }

    const pagesDir = path.join(process.cwd(), 'src', 'pages')
    const printerJsxPath = path.join(pagesDir, 'Printer.jsx')

    section('printer generator', 'building Printer.jsx page component')

    await ensureDir(pagesDir)
    await writeFile(printerJsxPath, printerContent)

    pass('created src/pages/Printer.jsx')
    await typeText(chalk.green.bold('\n✔ src/pages/Printer.jsx successfully created with socket print-image queue listener & react-to-print setup!'))
  } catch (error) {
    fail(error.message)
  }
}
