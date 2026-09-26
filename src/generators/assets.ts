import path from 'node:path'
import fs from 'node:fs'
import zlib from 'node:zlib'
import chalk from 'chalk'
import { section, pass, warn, fail, typeText } from '../ui/banner.js'
import { ensureDir, writeFile, pathExists, readFile, readDir, stat } from '../shared.js'

export const createAssetFolders = async (): Promise<void> => {
  try {
    const pkgJsonPath = path.join(process.cwd(), 'package.json')
    if (!(await pathExists(pkgJsonPath))) {
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
  } catch (error: any) {
    fail(error.message)
  }
}

export const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const escapeCssString = (value: string): string =>
  Array.from(String(value))
    .map((ch) => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? ' ' : ch))
    .join('')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')

export const getRelativeUrlPath = (filePath: string): string => {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const publicIndex = normalizedPath.toLowerCase().lastIndexOf('/public/')
  if (publicIndex !== -1) {
    return '/' + normalizedPath.slice(publicIndex + 8)
  }
  return '/' + path.basename(filePath)
}

export const getFontFiles = async (dir: string, filesList: string[] = []): Promise<string[]> => {
  const entries = await readDir(dir).catch(() => [])
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stats = await stat(fullPath)
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

export const getFontFormat = (ext: string): string => {
  switch (ext.toLowerCase()) {
    case '.ttf':
    case '.ttc':
      return 'format("truetype")'
    case '.otf':
      return 'format("opentype")'
    case '.woff':
      return 'format("woff")'
    case '.woff2':
      return 'format("woff2")'
    default:
      return ''
  }
}

export interface ParsedFontInfo {
  filename: string
  ext: string
  baseFamily: string
  fontFamily: string
  weight: number | string
  style: string
  format: string
}

export interface BinaryFontMeta {
  family?: string
  subfamily?: string
  weight?: number | string
  style?: string
}

// read internal true type and open type font tables
export const readBinaryFontMeta = (filePath: string): BinaryFontMeta | null => {
  try {
    const buf = fs.readFileSync(filePath)
    if (buf.length < 12) return null

    const magic = buf.toString('ascii', 0, 4)
    let numTables = 0
    let tableRecordsOffset = 12
    let isWoff = false

    if (magic === 'wOFF') {
      if (buf.length < 44) return null
      numTables = buf.readUInt16BE(12)
      tableRecordsOffset = 44
      isWoff = true
    } else if (magic === 'OTTO' || magic === '\x00\x01\x00\x00' || magic === 'true') {
      numTables = buf.readUInt16BE(4)
      tableRecordsOffset = 12
    } else {
      return null
    }

    let os2Data: Buffer | null = null
    let nameData: Buffer | null = null
    let hasFvar = false

    for (let i = 0; i < numTables; i++) {
      if (isWoff) {
        const recOffset = tableRecordsOffset + i * 20
        if (recOffset + 20 > buf.length) break
        const tag = buf.toString('ascii', recOffset, recOffset + 4)
        const offset = buf.readUInt32BE(recOffset + 4)
        const compLength = buf.readUInt32BE(recOffset + 8)
        const origLength = buf.readUInt32BE(recOffset + 12)
        if (tag === 'fvar') hasFvar = true
        if (tag === 'OS/2' || tag === 'name') {
          const rawSlice = buf.subarray(offset, offset + compLength)
          const decompressed = compLength < origLength ? zlib.inflateSync(rawSlice) : rawSlice
          if (tag === 'OS/2') os2Data = decompressed
          if (tag === 'name') nameData = decompressed
        }
      } else {
        const recOffset = tableRecordsOffset + i * 16
        if (recOffset + 16 > buf.length) break
        const tag = buf.toString('ascii', recOffset, recOffset + 4)
        const offset = buf.readUInt32BE(recOffset + 8)
        const length = buf.readUInt32BE(recOffset + 12)
        if (tag === 'fvar') hasFvar = true
        if (tag === 'OS/2') os2Data = buf.subarray(offset, offset + length)
        if (tag === 'name') nameData = buf.subarray(offset, offset + length)
      }
    }

    let weight: number | string | undefined
    let style: string | undefined

    if (hasFvar) {
      weight = '100 900'
    } else if (os2Data && os2Data.length >= 6) {
      const os2Weight = os2Data.readUInt16BE(4)
      if (os2Weight >= 100 && os2Weight <= 950) {
        weight = os2Weight
      }
      if (os2Data.length >= 64) {
        const fsSelection = os2Data.readUInt16BE(62)
        if ((fsSelection & 1) !== 0) {
          style = 'italic'
        }
      }
    }

    let family: string | undefined
    let subfamily: string | undefined

    if (nameData && nameData.length >= 6) {
      const count = nameData.readUInt16BE(2)
      const stringOffset = nameData.readUInt16BE(4)
      const nameEntries: Record<number, string> = {}

      for (let i = 0; i < count; i++) {
        const rec = 6 + i * 12
        if (rec + 12 > nameData.length) break
        const platformID = nameData.readUInt16BE(rec)
        const nameID = nameData.readUInt16BE(rec + 6)
        const length = nameData.readUInt16BE(rec + 8)
        const offset = stringOffset + nameData.readUInt16BE(rec + 10)
        if (offset + length > nameData.length) continue

        const strBuf = nameData.subarray(offset, offset + length)
        let decoded = ''
        if (platformID === 3 || platformID === 0) {
          decoded = strBuf.swap16().toString('utf16le')
        } else {
          decoded = strBuf.toString('utf8')
        }
        decoded = decoded.replace(/\0/g, '').trim()
        if (decoded && !nameEntries[nameID]) {
          nameEntries[nameID] = decoded
        }
      }

      family = nameEntries[16] || nameEntries[1]
      subfamily = nameEntries[17] || nameEntries[2]
      if (subfamily && subfamily.toLowerCase().includes('italic')) {
        style = 'italic'
      }
    }

    return { family, subfamily, weight, style }
  } catch {
    return null
  }
}

export const parseFontInfo = (filePath: string): ParsedFontInfo => {
  const ext = path.extname(filePath)
  const filename = path.basename(filePath, ext)
  const lowerName = filename.toLowerCase()

  const meta = readBinaryFontMeta(filePath)

  let style = meta?.style || (lowerName.includes('italic') ? 'italic' : 'normal')

  let weight: number | string = 400
  let suffix = ''

  if (meta?.weight !== undefined) {
    weight = meta.weight
    if (typeof weight === 'number') {
      if (weight >= 900) {
        suffix = ''
      } else if (weight >= 800) {
        suffix = '-xb'
      } else if (weight >= 700) {
        suffix = '-b'
      } else if (weight >= 600) {
        suffix = '-s'
      } else if (weight >= 500) {
        suffix = '-m'
      } else if (weight >= 400) {
        suffix = ''
      } else if (weight >= 300) {
        suffix = '-l'
      } else if (weight >= 200) {
        suffix = '-xl'
      } else if (weight >= 100) {
        suffix = '-t'
      }
    } else {
      suffix = ''
    }
  } else {
    // fallback to filename heuristics if binary read is unavailable
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
  }

  let cleanName = meta?.family || filename
  if (!meta?.family) {
    cleanName = cleanName
      .replace(/[-_]/g, ' ')
      .replace(/\b(ExtraBold|UltraBold|SemiBold|DemiBold|ExtraLight|UltraLight|Regular|Bold|Italic|VariableFont|Variable|Medium|Light|Thin|Black|Heavy|Book|Hairline)\b/gi, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])([0-9])/g, '$1 $2')
      .replace(/([0-9])([A-Za-z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
  }

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

export const getThemeSlug = (fontFamily: string, usedSlugs: Set<string>): string => {
  let primarySlug = fontFamily.split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (fontFamily.includes('-')) {
    primarySlug = fontFamily.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
  if (!usedSlugs.has(primarySlug)) {
    usedSlugs.add(primarySlug)
    return primarySlug
  }
  const fullSlug = fontFamily.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  usedSlugs.add(fullSlug)
  return fullSlug
}

export const configureFontAssets = async (): Promise<void> => {
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

    const rawFontFiles: string[] = []
    if (hasPrimary) {
      const files = await getFontFiles(fontsDirPrimary)
      rawFontFiles.push(...files)
    }
    if (hasSecondary) {
      const files = await getFontFiles(fontsDirSecondary)
      rawFontFiles.push(...files)
    }

    const fileMap = new Map<string, string>()
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

    const cssContent = await readFile(indexCssPath)
    let cssAppended = false

    section('font auto-config', 'scanning and registering local fonts')

    const newFontFaceBlocks: string[] = []
    const newThemeLines: string[] = []
    const usedSlugs = new Set<string>()

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
        updatedCss = updatedCss.replace(themeRegex, (_match, inner) => {
          const trimmedInner = inner.trimEnd()
          return `@theme {${trimmedInner}\n${newThemeLines.join('\n')}\n}`
        })
      } else {
        const themeBlock = `\n@theme {\n${newThemeLines.join('\n')}\n}\n`
        updatedCss = updatedCss.trimEnd() + '\n' + themeBlock
      }
    }

    await writeFile(indexCssPath, updatedCss)
    await typeText(chalk.green.bold('\n✅ src/index.css successfully updated with custom font classes!'))
  } catch (error: any) {
    fail(error.message)
  }
}

export const getImageFiles = async (dir: string, filesList: string[] = []): Promise<string[]> => {
  const entries = await readDir(dir).catch(() => [])
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stats = await stat(fullPath)
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

export const getImageKey = (filePath: string, imagesDir: string): string => {
  const relativePath = path.relative(imagesDir, filePath)
  const ext = path.extname(relativePath)
  const baseName = relativePath.slice(0, -ext.length)
  const parts = baseName.split(/[\\/_\-\s]+/).filter(Boolean)

  if (parts.length === 0) return 'image'

  return parts
    .map((part, index) => {
      const cleanPart = part.replace(/[^a-zA-Z0-9]/g, '')
      if (index === 0) {
        return cleanPart.toLowerCase()
      }
      return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1).toLowerCase()
    })
    .join('')
}

export const configureImageAssets = async (): Promise<void> => {
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

    const imageItems: { filePath: string; dir: string }[] = []
    if (hasPrimary) {
      const files = await getImageFiles(imagesDirPrimary)
      imageItems.push(...files.map((f) => ({ filePath: f, dir: imagesDirPrimary })))
    }
    if (hasSecondary) {
      const files = await getImageFiles(imagesDirSecondary)
      imageItems.push(...files.map((f) => ({ filePath: f, dir: imagesDirSecondary })))
    }

    if (imageItems.length === 0) {
      console.log(chalk.yellow('No image files found under public/images/ or public/assets/images/'))
      return
    }

    section('image auto-config', 'scanning and mapping local images')

    const imageMap: Record<string, string> = {}
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
    await typeText(chalk.green.bold('\n✅ src/utils/images.js successfully generated with custom image constants!'))
  } catch (error: any) {
    fail(error.message)
  }
}
