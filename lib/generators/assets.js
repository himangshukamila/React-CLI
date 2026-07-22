import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { section, pass, warn, fail, typeText } from '../ui/banner.js'
import { ensureDir, writeFile, pathExists, readFile, readDir } from '../shared.js'

export const createAssetFolders = async () => {
  try {
    const pkgJsonPath = path.join(process.cwd(), 'package.json')
    if (!await pathExists(pkgJsonPath)) {
      throw new Error('Not inside a React project. Run this from your app folder.')
    }

    const folders = [
      path.join(process.cwd(), 'public', 'assets', 'images'),
      path.join(process.cwd(), 'public', 'assets', 'icons'),
      path.join(process.cwd(), 'public', 'assets', 'fonts'),
    ]

    section('asset', 'create asset folders')

    for (const folderPath of folders) {
      const relativePath = path.relative(process.cwd(), folderPath)
      if (await pathExists(folderPath)) {
        warn(`folder already exists: ${relativePath}`)
        continue
      }

      await ensureDir(folderPath)
      pass(`created ${relativePath}`)
    }
  } catch (error) {
    fail(error.message)
  }
}

export const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const escapeCssString = (value) =>
  Array.from(String(value))
    .map((ch) => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? ' ' : ch))
    .join('')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')

export const getRelativeUrlPath = (filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const publicIndex = normalizedPath.toLowerCase().lastIndexOf('/public/')
  if (publicIndex !== -1) {
    return '/' + normalizedPath.slice(publicIndex + 8)
  }
  return '/' + path.basename(filePath)
}

export const getFontFiles = async (dir, filesList = []) => {
  const entries = await readDir(dir).catch(() => [])
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      await getFontFiles(fullPath, filesList)
    } else {
      const ext = path.extname(entry).toLowerCase()
      if (['.ttf', '.woff', '.woff2', '.otf', '.ttc'].includes(ext)) {
        filesList.push(fullPath)
      }
    }
  }
  return filesList
}

export const getFontFormat = (ext) => {
  switch (ext.toLowerCase()) {
    case '.ttf':
    case '.ttc': return 'format("truetype")'
    case '.otf': return 'format("opentype")'
    case '.woff': return 'format("woff")'
    case '.woff2': return 'format("woff2")'
    default: return ''
  }
}

export const parseFontInfo = (filePath) => {
  const ext = path.extname(filePath)
  const filename = path.basename(filePath, ext)
  const lowerName = filename.toLowerCase()

  const style = lowerName.includes('italic') ? 'italic' : 'normal'

  let weight = 400
  let suffix = ''

  if (lowerName.includes('variable')) {
    weight = '100 900'
    suffix = ''
  } else if (lowerName.includes('black') || lowerName.includes('heavy')) {
    weight = 900
    suffix = ''
  } else if (lowerName.includes('extrabold') || lowerName.includes('ultrabold')) {
    weight = 800
    suffix = '-xb'
  } else if (lowerName.includes('semibold') || lowerName.includes('demibold')) {
    weight = 600
    suffix = '-s'
  } else if (lowerName.includes('bold')) {
    weight = 700
    suffix = '-b'
  } else if (lowerName.includes('medium')) {
    weight = 500
    suffix = '-m'
  } else if (lowerName.includes('regular') || lowerName.includes('book')) {
    weight = 400
    suffix = ''
  } else if (lowerName.includes('extralight') || lowerName.includes('ultralight')) {
    weight = 200
    suffix = '-xl'
  } else if (lowerName.includes('light')) {
    weight = 300
    suffix = '-l'
  } else if (lowerName.includes('thin') || lowerName.includes('hairline')) {
    weight = 100
    suffix = '-t'
  }

  let cleanName = filename
    .replace(/[-_]/g, ' ')
    .replace(/\b(ExtraBold|UltraBold|SemiBold|DemiBold|ExtraLight|UltraLight|Regular|Bold|Italic|VariableFont|Variable|Medium|Light|Thin|Black|Heavy|Book|Hairline)\b/gi, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleanName) {
    cleanName = filename.replace(/[-_]/g, ' ').trim()
  }

  const baseFamily = cleanName
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  const fontFamily = `${baseFamily}${suffix}`

  return {
    filename,
    ext,
    baseFamily,
    fontFamily,
    weight,
    style,
    format: getFontFormat(ext),
  }
}

export const getThemeSlug = (fontFamily, usedSlugs) => {
  let primarySlug = fontFamily.split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (fontFamily.includes('-')) {
    primarySlug = fontFamily.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
  if (!usedSlugs.has(primarySlug)) {
    usedSlugs.add(primarySlug)
    return primarySlug
  }
  let fullSlug = fontFamily.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  usedSlugs.add(fullSlug)
  return fullSlug
}

export const configureFontAssets = async () => {
  try {
    const fontsDirPrimary = path.join(process.cwd(), 'public', 'fonts')
    const fontsDirSecondary = path.join(process.cwd(), 'public', 'assets', 'fonts')
    const indexCssPath = path.join(process.cwd(), 'src', 'index.css')

    const hasPrimary = await pathExists(fontsDirPrimary)
    const hasSecondary = await pathExists(fontsDirSecondary)

    if (!hasPrimary && !hasSecondary) {
      throw new Error(`Font directory (public/fonts or public/assets/fonts) does not exist. Run 'react asset' or create it first.`)
    }

    if (!(await pathExists(indexCssPath))) {
      throw new Error(`Stylesheet src/index.css does not exist.`)
    }

    let rawFontFiles = []
    if (hasPrimary) {
      const files = await getFontFiles(fontsDirPrimary)
      rawFontFiles.push(...files)
    }
    if (hasSecondary) {
      const files = await getFontFiles(fontsDirSecondary)
      rawFontFiles.push(...files)
    }

    const fileMap = new Map()
    for (const f of rawFontFiles) {
      const relUrl = getRelativeUrlPath(f)
      if (!fileMap.has(relUrl)) {
        fileMap.set(relUrl, f)
      }
    }
    const fontFiles = Array.from(fileMap.values())

    if (fontFiles.length === 0) {
      console.log(chalk.yellow('No font files found under public/fonts/ or public/assets/fonts/'))
      return
    }

    let cssContent = await readFile(indexCssPath, 'utf8')
    let cssAppended = false

    section('font auto-config', 'scanning and registering local fonts')

    const newFontFaceBlocks = []
    const newThemeLines = []
    const usedSlugs = new Set()

    const existingThemeVars = cssContent.match(/--font-([a-z0-9-]+)\s*:/g) || []
    existingThemeVars.forEach((v) => {
      const m = v.match(/--font-([a-z0-9-]+)/)
      if (m) usedSlugs.add(m[1])
    })

    for (const filePath of fontFiles) {
      const relUrlPath = getRelativeUrlPath(filePath)
      const escapedPath = escapeRegExp(relUrlPath)
      const urlRegex = new RegExp(`url\\(['"]?${escapedPath}['"]?\\)`, 'i')
      if (urlRegex.test(cssContent)) {
        continue
      }

      const fontInfo = parseFontInfo(filePath)
      const slug = getThemeSlug(fontInfo.fontFamily, usedSlugs)

      const faceBlock = `@font-face {
  font-family: "${escapeCssString(fontInfo.fontFamily)}";
  src: url("${escapeCssString(relUrlPath)}") ${fontInfo.format};
  font-weight: ${fontInfo.weight};
  font-style: ${fontInfo.style};
  font-display: swap;
}`

      newFontFaceBlocks.push(faceBlock)
      newThemeLines.push(`  --font-${slug}: "${escapeCssString(fontInfo.fontFamily)}", sans-serif;`)
      cssAppended = true
      pass(`registered ${fontInfo.fontFamily} (${path.basename(filePath)})`)
    }

    if (!cssAppended) {
      console.log(chalk.gray('\nAll fonts are already configured in src/index.css'))
      return
    }

    let updatedCss = cssContent

    if (newFontFaceBlocks.length > 0) {
      const fontFaceGroup = '\n' + newFontFaceBlocks.join('\n\n') + '\n'
      const themeIndex = updatedCss.indexOf('@theme')
      if (themeIndex !== -1) {
        updatedCss = updatedCss.slice(0, themeIndex) + fontFaceGroup + '\n' + updatedCss.slice(themeIndex)
      } else {
        updatedCss = updatedCss.trimEnd() + '\n' + fontFaceGroup
      }
    }

    if (newThemeLines.length > 0) {
      const themeRegex = /@theme\s*\{([^}]*)\}/
      if (themeRegex.test(updatedCss)) {
        updatedCss = updatedCss.replace(themeRegex, (match, inner) => {
          const trimmedInner = inner.trimEnd()
          return `@theme {${trimmedInner}\n${newThemeLines.join('\n')}\n}`
        })
      } else {
        const themeBlock = `\n@theme {\n${newThemeLines.join('\n')}\n}\n`
        updatedCss = updatedCss.trimEnd() + '\n' + themeBlock
      }
    }

    await writeFile(indexCssPath, updatedCss)
    await typeText(chalk.green.bold('\n✔ src/index.css successfully updated with custom font classes!'))
  } catch (error) {
    fail(error.message)
  }
}

export const getImageFiles = async (dir, filesList = []) => {
  const entries = await readDir(dir).catch(() => [])
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      await getImageFiles(fullPath, filesList)
    } else {
      const ext = path.extname(entry).toLowerCase()
      if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'].includes(ext)) {
        filesList.push(fullPath)
      }
    }
  }
  return filesList
}

export const getImageKey = (filePath, imagesDir) => {
  const relativePath = path.relative(imagesDir, filePath)
  const ext = path.extname(relativePath)
  const baseName = relativePath.slice(0, -ext.length)
  const parts = baseName.split(/[\\/_\-\s]+/).filter(Boolean)
  
  if (parts.length === 0) return 'image'
  
  return parts.map((part, index) => {
    const cleanPart = part.replace(/[^a-zA-Z0-9]/g, '')
    if (index === 0) {
      return cleanPart.toLowerCase()
    }
    return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1).toLowerCase()
  }).join('')
}

export const configureImageAssets = async () => {
  try {
    const imagesDirPrimary = path.join(process.cwd(), 'public', 'images')
    const imagesDirSecondary = path.join(process.cwd(), 'public', 'assets', 'images')
    const utilsDir = path.join(process.cwd(), 'src', 'utils')
    const imagesJsPath = path.join(utilsDir, 'images.js')

    const hasPrimary = await pathExists(imagesDirPrimary)
    const hasSecondary = await pathExists(imagesDirSecondary)

    if (!hasPrimary && !hasSecondary) {
      throw new Error(`Directory public/images or public/assets/images does not exist. Run 'react asset' or create it first.`)
    }

    let imageItems = []
    if (hasPrimary) {
      const files = await getImageFiles(imagesDirPrimary)
      imageItems.push(...files.map(f => ({ filePath: f, dir: imagesDirPrimary })))
    }
    if (hasSecondary) {
      const files = await getImageFiles(imagesDirSecondary)
      imageItems.push(...files.map(f => ({ filePath: f, dir: imagesDirSecondary })))
    }

    if (imageItems.length === 0) {
      console.log(chalk.yellow('No image files found under public/images/ or public/assets/images/'))
      return
    }

    section('image auto-config', 'scanning and mapping local images')

    const imageMap = {}
    for (const item of imageItems) {
      const key = getImageKey(item.filePath, item.dir)
      const relativeUrlPath = getRelativeUrlPath(item.filePath)
      imageMap[key] = relativeUrlPath
      pass(`mapped image: ${key} ➔ ${relativeUrlPath}`)
    }

    const sortedKeys = Object.keys(imageMap).sort()
    let jsContent = 'export const images = {\n'
    for (const key of sortedKeys) {
      jsContent += `  ${key}: ${JSON.stringify(imageMap[key])},\n`
    }
    jsContent += '}\n'

    await ensureDir(utilsDir)
    await writeFile(imagesJsPath, jsContent)
    await typeText(chalk.green.bold('\n✔ src/utils/images.js successfully generated with custom image constants!'))
  } catch (error) {
    fail(error.message)
  }
}
