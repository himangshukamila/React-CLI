import path from 'node:path'
import { pass, warn, fail } from '../ui/banner.js'
import { ensureDir, writeFile, pathExists, readDir, fileNameRegex } from '../shared.js'

export const toPascalCase = (value) => value
  .split(/[-_\s]+/)
  .filter(Boolean)
  .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
  .join('')

export const toCamelCase = (value) => {
  const pascal = toPascalCase(value)
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`
}

export const validatePathSegments = (segments) => {
  segments.forEach((segment) => {
    if (!fileNameRegex.test(segment) || segment.includes('..')) {
      throw new Error('Invalid file or folder name')
    }
  })
}

export const parseFolderTarget = (folderName) => {
  const folderParts = folderName.split(/[\\/]/).filter(Boolean)

  if (folderParts.length === 0 || folderName.includes('..')) {
    throw new Error('Invalid folder name')
  }

  validatePathSegments(folderParts)
  return folderParts
}

export const parseMakeTarget = (folderName, name, subfolder) => {
  const baseFolderParts = folderName.split(/[\\/]/).filter(Boolean)
  const nameParts = name.split(/[\\/]/).filter(Boolean)
  const subfolderParts = subfolder ? subfolder.split(/[\\/]/).filter(Boolean) : []
  const allParts = [...baseFolderParts, ...subfolderParts, ...nameParts]

  if (
    baseFolderParts.length === 0
    || nameParts.length === 0
    || folderName.includes('..')
    || name.includes('..')
    || (subfolder && subfolder.includes('..'))
  ) {
    throw new Error('Invalid file or folder name')
  }

  validatePathSegments(allParts)

  return {
    baseFolders: baseFolderParts,
    folders: [...subfolderParts, ...nameParts.slice(0, -1)],
    baseName: nameParts.at(-1),
  }
}

export const makeTemplates = {
  component: (name) => `const ${name} = () => {
  return (
    <section className="p-4">
      <h2 className="text-xl font-semibold text-zinc-100 font-sans">${name}</h2>
    </section>
  )
}

export default ${name}
`,
  page: (name) => `const ${name} = () => {
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-zinc-100 font-sans">${name}</h1>
    </main>
  )
}

export default ${name}
`,
  hook: (name) => `import { useState } from 'react'

export const ${name} = (initialValue = null) => {
  const [value, setValue] = useState(initialValue)

  return { value, setValue }
}
`,
  service: (name) => `const ${name} = {
  async get(url, options = {}) {
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new Error(\`Request failed with status \${response.status}\`)
    }

    return response.json()
  },
}

export default ${name}
`,
  default: (name) => `export const ${name} = () => {
  return null
}
`,
}

export const makeConfig = {
  component: { ext: 'jsx', format: toPascalCase, template: 'component' },
  page: { ext: 'jsx', format: toPascalCase, template: 'page' },
  hook: {
    ext: 'js',
    format: (name) => {
      const formatted = toPascalCase(name.replace(/^use/i, ''))
      return `use${formatted}`
    },
    template: 'hook',
  },
  service: { ext: 'js', format: toCamelCase, template: 'service' },
  default: { ext: 'js', format: toCamelCase, template: 'default' },
}

export const makeFolderKinds = {
  component: 'component',
  components: 'component',
  page: 'page',
  pages: 'page',
  hook: 'hook',
  hooks: 'hook',
  service: 'service',
  services: 'service',
}

export const ensureExistingFolder = async (folderPath) => {
  const relativePath = path.relative(process.cwd(), folderPath)

  if (!(await pathExists(folderPath))) {
    throw new Error(`Folder does not exist: ${relativePath}. Create this folder first.`)
  }

  try {
    await readDir(folderPath)
  } catch {
    throw new Error(`Path is not a folder: ${relativePath}`)
  }
}

export const makeFolder = async (folderName) => {
  const folderParts = parseFolderTarget(folderName)
  const targetPath = path.join(process.cwd(), 'src', ...folderParts)
  const relativePath = path.relative(process.cwd(), targetPath)

  if (await pathExists(targetPath)) {
    warn(`folder already exists: ${relativePath}`)
    return
  }

  await ensureDir(targetPath)
  pass(`created ${relativePath}`)
}

export const makeFile = async (folderName, name, subfolder) => {
  try {
    if (folderName === 'f' || folderName === 'folder') {
      await makeFolder(name)
      return
    }

    const target = parseMakeTarget(folderName, name, subfolder)
    const kind = makeFolderKinds[target.baseFolders.at(-1).toLowerCase()] || 'default'
    const config = makeConfig[kind]
    const exportName = config.format(target.baseName)
    const fileName = `${exportName}.${config.ext}`
    const targetDir = path.join(process.cwd(), 'src', ...target.baseFolders, ...target.folders)
    const targetPath = path.join(targetDir, fileName)

    await ensureDir(targetDir)

    if (await pathExists(targetPath)) {
      throw new Error(`File already exists: ${targetPath}`)
    }

    await writeFile(targetPath, makeTemplates[config.template](exportName))
    pass(`created ${path.relative(process.cwd(), targetPath)}`)
  } catch (error) {
    fail(error.message)
  }
}
