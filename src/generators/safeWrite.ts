import path from 'node:path'
import crypto from 'node:crypto'
import { pathExists, readFile, writeFile } from '../shared.js'
import { pass, warn } from '../ui/banner.js'
import { customConfirm } from '../ui/prompts.js'

const MARKER = '// zecron:generated '

const hashBody = (body: string): string =>
  crypto.createHash('sha1').update(body).digest('hex').slice(0, 12)

// stamp the generated body so a later run can tell it apart from a hand edit
const stamp = (content: string): string => `${MARKER}${hashBody(content)}\n${content}`

const unstamp = (content: string): { body: string; hash: string | null } => {
  const newlineAt = content.indexOf('\n')
  const firstLine = newlineAt === -1 ? content : content.slice(0, newlineAt)

  if (!firstLine.startsWith(MARKER)) return { body: content, hash: null }

  return {
    hash: firstLine.slice(MARKER.length).trim(),
    body: newlineAt === -1 ? '' : content.slice(newlineAt + 1),
  }
}

export interface WriteGeneratedOptions {
  projectRoot?: string
  message?: string
}

/**
 * Write a generated file without silently destroying hand edits.
 *
 * An untouched file that this CLI wrote is regenerated freely, so re-running a
 * generator to change its output stays a one-liner. A file that was edited by
 * hand — or that predates the stamp — needs a confirmation first, and answering
 * no (or running without a TTY) keeps whatever is on disk.
 *
 * Returns true only when the file was actually written.
 */
export const writeGenerated = async (
  filePath: string,
  content: string,
  { projectRoot = process.cwd(), message }: WriteGeneratedOptions = {}
): Promise<boolean> => {
  const relativePath = path.relative(projectRoot, filePath) || path.basename(filePath)

  if (await pathExists(filePath)) {
    const { body, hash } = unstamp(await readFile(filePath))
    const isPristine = Boolean(hash) && hash === hashBody(body)

    if (isPristine && body === content) {
      pass(`${relativePath} is already up to date`)
      return false
    }

    if (!isPristine) {
      const replace = await customConfirm({
        message: message || `${relativePath} has hand edits. Replace it?`,
        initialValue: false,
      })

      if (!replace) {
        warn(`kept existing ${relativePath}`, 'run again after saving your changes elsewhere')
        return false
      }
    }
  }

  await writeFile(filePath, stamp(content))
  return true
}
