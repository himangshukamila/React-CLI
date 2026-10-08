import path from 'node:path'
import { ensureDeps, ensureDir, readFile, readTemplate } from '../shared.js'
import { pass, section } from '../ui/banner.js'
import { writeGenerated } from './safeWrite.js'

export const cameraPackages = ['react-webcam@^7.2.0', 'clsx@^2.1.1', 'react-error-boundary@^6.0.0']

export const configureCameraBoilerplate = async (projectPath: string = process.cwd()): Promise<void> => {
  section('camera generator', 'setting up camera capture and photo preview')
  const installed = await ensureDeps(projectPath, cameraPackages)
  if (installed.length > 0) pass('installed ' + installed.join(', '))

  const files = [
    ['components', 'Preview.jsx'],
    ['pages', 'Camera.jsx'],
  ]
  for (const [folder, name] of files) {
    const directory = path.join(projectPath, 'src', folder)
    await ensureDir(directory)
    const content = await readTemplate('camera', name)
    const filePath = path.join(directory, name)
    if (await writeGenerated(filePath, content, { projectRoot: projectPath })) {
      pass('created src/' + folder + '/' + name)
    } else if ((await readFile(filePath)).replace(/^\/\/ zecron:generated [^\n]*\n/, '') !== content) {
      throw new Error('Camera setup stopped because src/' + folder + '/' + name + ' was kept. Back up that file and rerun to generate the matching camera and preview pair.')
    }
  }
}
