import path from 'node:path'
import { ensureDir, readTemplate } from '../shared.js'
import { pass, section } from '../ui/banner.js'
import { writeGenerated } from './safeWrite.js'

export const configureDeviceInfo = async (projectPath: string = process.cwd()): Promise<void> => {
  section('device info generator', 'setting up browser and device diagnostics')
  const content = await readTemplate('device', 'deviceInfo.js')
  const directory = path.join(projectPath, 'src', 'utils')
  await ensureDir(directory)
  const written = await writeGenerated(path.join(directory, 'deviceInfo.js'), content, { projectRoot: projectPath })
  if (written) pass('created src/utils/deviceInfo.js')
}
