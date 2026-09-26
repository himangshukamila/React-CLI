import path from 'node:path'
import chalk from 'chalk'
import { section, pass, fail, typeText } from '../ui/banner.js'
import {
  ensureDir,
  ensureDeps,
  pathExists,
  configureSocket,
  printerContent,
} from '../shared.js'
import { writeGenerated } from './safeWrite.js'

export const configurePrinterBoilerplate = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    section('printer generator', 'building Printer.jsx page component')

    const installed = await ensureDeps(projectPath, ['react-to-print', 'socket.io-client'])
    if (installed.length > 0) pass(`installed ${installed.join(', ')}`)

    const servicesDir = path.join(projectPath, 'src', 'services')
    const socketPath = path.join(servicesDir, 'socket.js')
    if (!(await pathExists(socketPath))) {
      await configureSocket(projectPath)
      pass('created src/services/socket.js')
    }

    const pagesDir = path.join(projectPath, 'src', 'pages')
    await ensureDir(pagesDir)

    const written = await writeGenerated(
      path.join(pagesDir, 'Printer.jsx'),
      printerContent,
      { projectRoot: projectPath }
    )

    if (!written) return

    pass('created src/pages/Printer.jsx')
    await typeText(
      chalk.green.bold(
        '\n✅ src/pages/Printer.jsx created with the socket print queue and react-to-print!\n' +
          '   Props: event, serverUrl, getImagePath, autoPrint, previewSize, paperSize,\n' +
          '   objectFit, className, onPrinted, onError.'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
