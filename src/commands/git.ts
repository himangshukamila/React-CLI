import path from 'node:path'
import readline from 'node:readline'
import chalk from 'chalk'
import { execa } from 'execa'
import { section, fail, typeText } from '../ui/banner.js'
import { pathExists } from '../shared.js'

export const isSafeRemoteUrl = (url: any): boolean => {
  if (typeof url !== 'string' || !url.trim()) return false
  if (url.includes('::')) return false
  if (Array.from(url).some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) return false
  return /^(https?|git|ssh):\/\//i.test(url) || /^[\w.-]+@[\w.-]+:.+$/.test(url)
}

export const generateAutoCommitMessage = async (): Promise<string> => {
  try {
    const result = await execa('git', ['status', '--porcelain'], { cwd: process.cwd(), reject: false })
    const stdout = result.stdout || ''
    const lines = stdout.trim().split('\n').filter(Boolean)

    if (lines.length === 0) {
      return 'update project files'
    }

    const modifiedFiles: string[] = []
    const addedFiles: string[] = []
    const deletedFiles: string[] = []
    const renamedFiles: string[] = []

    lines.forEach((line) => {
      const status = line.slice(0, 2).trim()
      let filePath = line.slice(3).trim()
      if (filePath.includes('->')) {
        filePath = filePath.split('->')[1].trim()
      }
      filePath = filePath.replace(/^"|"$/g, '')

      if (status.includes('D')) {
        deletedFiles.push(filePath)
      } else if (status.includes('A') || status === '??') {
        addedFiles.push(filePath)
      } else if (status.includes('R')) {
        renamedFiles.push(filePath)
      } else {
        modifiedFiles.push(filePath)
      }
    })

    const allChangedFiles = [...modifiedFiles, ...addedFiles, ...deletedFiles, ...renamedFiles]

    if (allChangedFiles.length === 1) {
      const file = allChangedFiles[0]
      let baseName = path.basename(file)
      if (baseName.toLowerCase().startsWith('readme')) {
        baseName = 'README.md'
      }

      if (addedFiles.length === 1) return `add ${baseName}`
      if (deletedFiles.length === 1) return `remove ${baseName}`
      if (renamedFiles.length === 1) return `rename ${baseName}`
      return `update ${baseName}`
    }

    const categories = new Set<string>()

    allChangedFiles.forEach((file) => {
      const normalized = file.replace(/\\/g, '/').toLowerCase()
      if (normalized.startsWith('src/components/')) {
        categories.add('components')
      } else if (normalized.startsWith('src/pages/')) {
        categories.add('pages')
      } else if (normalized.startsWith('src/hooks/')) {
        categories.add('hooks')
      } else if (normalized.startsWith('src/services/')) {
        categories.add('services')
      } else if (normalized.startsWith('src/store/')) {
        categories.add('state store')
      } else if (normalized.startsWith('src/utils/')) {
        categories.add('utilities')
      } else if (normalized.startsWith('public/fonts/') || normalized.startsWith('public/assets/fonts/')) {
        categories.add('fonts')
      } else if (normalized.startsWith('public/images/') || normalized.startsWith('public/assets/images/')) {
        categories.add('images')
      } else if (normalized.endsWith('.css') || normalized.endsWith('.scss')) {
        categories.add('styling')
      } else if (normalized.endsWith('.md') || normalized.includes('readme') || normalized.includes('license')) {
        categories.add('documentation')
      } else if (normalized === 'package.json' || normalized === 'package-lock.json') {
        categories.add('dependencies')
      } else if (normalized === 'vite.config.js' || normalized.startsWith('.env')) {
        categories.add('project config')
      }
    })

    const categoryList = Array.from(categories)

    if (categoryList.length > 0 && categoryList.length <= 3) {
      const action = addedFiles.length > modifiedFiles.length ? 'add and update' : 'update'
      return `${action} ${categoryList.join(', ')}`
    }

    const mainAction = addedFiles.length > modifiedFiles.length ? 'add' : 'update'
    return `${mainAction} project files (${allChangedFiles.length} files changed)`
  } catch (_error) {
    return 'update project files'
  }
}

// cap the replayed push summary so a noisy remote cannot flood the terminal
const maxGitSummaryLines = 15

export interface GitOutputLine {
  text: string
  persistent: boolean
}

/**
 * Split raw git output into lines.
 *
 * Git terminates transient progress updates with \r ("Writing objects: 45%
 * (39/87)") and final messages with \n ("Writing objects: 100% (87/87), done.").
 * The terminator is what tells us whether a line should be redrawn in place or
 * kept on screen, so the parser preserves it.
 *
 * Returns the parsed lines plus any trailing partial chunk, which the caller
 * must carry into the next read.
 */
export const parseGitOutputChunk = (chunk: string): { lines: GitOutputLine[]; rest: string } => {
  const lines: GitOutputLine[] = []
  const pattern = /([^\r\n]*)(\r\n|\n|\r)/g
  let consumed = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(chunk)) !== null) {
    consumed = pattern.lastIndex
    const text = match[1].trim()
    if (text) lines.push({ text, persistent: match[2] !== '\r' })
  }

  return { lines, rest: chunk.slice(consumed) }
}

export const styleGitProgressLine = (line: string): string => {
  const highlighted = line
    .replace(/(\d+%)/g, chalk.hex('#38BDF8').bold('$1'))
    .replace(/(\(\d+\/\d+\))/g, chalk.hex('#F59E0B')('$1'))

  if (/^remote:/i.test(line)) return chalk.hex('#A855F7')(highlighted)
  if (/\bdone\.?$/.test(line)) return chalk.hex('#10B981')(highlighted)
  return chalk.hex('#CBD5E1')(highlighted)
}

interface GitStepOutput {
  persistentLines: string[]
  progressActive: boolean
}

/**
 * Mirror git's stderr onto the status line while the step runs, so a long push
 * reports "Writing objects: 45% (39/87)" instead of sitting silent.
 */
const attachGitOutput = (
  child: { stderr?: NodeJS.ReadableStream | null },
  canRender: boolean
): GitStepOutput => {
  const state: GitStepOutput = { persistentLines: [], progressActive: false }
  if (!child.stderr) return state

  let buffer = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    const { lines, rest } = parseGitOutputChunk(buffer + chunk)
    buffer = rest

    for (const { text, persistent } of lines) {
      if (persistent) state.persistentLines.push(text)
      if (!canRender) continue

      // the first update closes the "running" status line and opens one below it
      if (!state.progressActive) {
        process.stdout.write('\n')
        state.progressActive = true
      }

      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)

      // a final line is committed to the scrollback; a transient one is left
      // unterminated so the next frame redraws over it
      const terminator = persistent ? '\n' : ''
      process.stdout.write(`${chalk.hex('#8B5CF6')('  │')} ${styleGitProgressLine(text)}${terminator}`)
    }
  })

  return state
}

// drop whatever is on the current line so the result can be written over it
const clearStatusLine = (): void => {
  if (!process.stdout.isTTY) return

  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
}

export interface GitPushOptions {
  github?: string | boolean
  git?: string
  message?: string
}

export const gitPushWrapper = async (options: GitPushOptions): Promise<void> => {
  const steps: { label: string; cmd: string; args: string[] }[] = []
  const gitDirExists = await pathExists(path.join(process.cwd(), '.git'))
  const autoCommitMessage = await generateAutoCommitMessage()

  if (options.github) {
    const isGitHubUrl = typeof options.github === 'string' && (/^(https?:\/\/|git@|git:\/\/)/.test(options.github) || options.github.endsWith('.git'))
    const isFlagOnly = options.github === true

    if (isGitHubUrl) {
      if (!isSafeRemoteUrl(options.github)) {
        fail('Unsafe git remote URL. Use an https://, ssh://, git:// or git@host:path URL.')
      }
      steps.push(
        {
          label: 'Initialize Git repository',
          cmd: 'git',
          args: ['init'],
        },
        {
          label: 'Stage all files',
          cmd: 'git',
          args: ['add', '.'],
        },
        {
          label: `Create first commit: "${autoCommitMessage}"`,
          cmd: 'git',
          args: ['commit', '-m', autoCommitMessage],
        },
        {
          label: 'Rename branch to main',
          cmd: 'git',
          args: ['branch', '-M', 'main'],
        },
        {
          label: `Add remote origin (${options.github})`,
          cmd: 'git',
          args: ['remote', 'add', 'origin', options.github as string],
        },
        {
          label: 'Push branch main to origin',
          cmd: 'git',
          args: ['push', '--progress', '-u', 'origin', 'main'],
        },
      )
    } else {
      if (!gitDirExists) {
        fail('Error: This directory is not a Git repository. Please initialize it by providing the remote URL: react push --github <url>')
      }
      const commitMessage = isFlagOnly ? autoCommitMessage : (options.github as string)
      steps.push(
        {
          label: 'Stage all files',
          cmd: 'git',
          args: ['add', '.'],
        },
        {
          label: `Create commit: "${commitMessage}"`,
          cmd: 'git',
          args: ['commit', '-m', commitMessage],
        },
        {
          label: 'Push changes',
          cmd: 'git',
          args: ['push', '--progress'],
        },
      )
    }
  } else {
    const repoUrl = options.git
    const commitMessage = options.message || autoCommitMessage

    if (repoUrl && !isSafeRemoteUrl(repoUrl)) {
      fail('Unsafe git remote URL. Use an https://, ssh://, git:// or git@host:path URL.')
    }

    if (!gitDirExists && !repoUrl) {
      fail('Error: This directory is not a Git repository. Please initialize it by providing the remote URL: react push --git <url>')
    }

    if (!gitDirExists && repoUrl) {
      steps.push(
        {
          label: 'Initialize Git repository',
          cmd: 'git',
          args: ['init'],
        },
        {
          label: 'Create and switch to main branch',
          cmd: 'git',
          args: ['checkout', '-b', 'main'],
        },
        {
          label: 'Stage all files',
          cmd: 'git',
          args: ['add', '.'],
        },
        {
          label: `Create first commit: "${commitMessage}"`,
          cmd: 'git',
          args: ['commit', '-m', commitMessage],
        },
        {
          label: `Add remote origin (${repoUrl})`,
          cmd: 'git',
          args: ['remote', 'add', 'origin', repoUrl],
        },
        {
          label: 'Push branch main to origin',
          cmd: 'git',
          args: ['push', '--progress', '-u', 'origin', 'main'],
        },
      )
    } else {
      steps.push(
        {
          label: 'Stage all files',
          cmd: 'git',
          args: ['add', '.'],
        },
        {
          label: `Create commit: "${commitMessage}"`,
          cmd: 'git',
          args: ['commit', '-m', commitMessage],
        },
        {
          label: 'Push branch main to origin',
          cmd: 'git',
          args: ['push', '--progress', '-u', 'origin', 'main'],
        },
      )
    }
  }

  section('git setup & push', gitDirExists ? 'pushing updates' : 'linking workspace to remote')

  for (const step of steps) {
    const cmdStr = `${step.cmd} ${step.args.join(' ')}`
    const displayLabel = `${chalk.bold.whiteBright(step.label)} ${chalk.hex('#38BDF8')(`(${cmdStr})`)}`

    const isPushStep = step.args.includes('push')
    let output: GitStepOutput = { persistentLines: [], progressActive: false }

    // without a TTY the status line cannot be overwritten, so end it properly
    const statusEnd = process.stdout.isTTY ? '' : '\n'
    process.stdout.write(`${chalk.hex('#EC4899')('⚡ running')}  ${displayLabel}...${statusEnd}`)
    try {
      const child = execa(step.cmd, step.args, { cwd: process.cwd() })
      output = attachGitOutput(child, Boolean(process.stdout.isTTY))
      const result = await child

      clearStatusLine()
      await typeText(`${chalk.hex('#10B981').bold('✅ success')}  ${displayLabel}`)

      if (result.stdout && result.stdout.trim()) {
        const allLines = result.stdout.trim().split('\n')
        // a large commit lists every file; keep the summary, drop the tail
        const outputLines = allLines.slice(0, maxGitSummaryLines)
        for (const line of outputLines) {
          let styledLine = chalk.hex('#CBD5E1')(line)
          if (line.includes('files changed') || line.includes('insertions(+)')) {
            styledLine = line
              .replace(/(\d+ files? changed)/g, chalk.hex('#38BDF8').bold('$1'))
              .replace(/(\d+ insertions?\(\+\))/g, chalk.hex('#10B981').bold('$1'))
              .replace(/(\d+ deletions?\(-\))/g, chalk.hex('#EF4444').bold('$1'))
          } else if (line.trim().startsWith('[') && line.includes(']')) {
            styledLine = chalk.hex('#F59E0B').bold(line)
          } else if (line.includes('create mode') || line.includes('delete mode')) {
            styledLine = chalk.hex('#A855F7')(line)
          }
          await typeText(`${chalk.hex('#8B5CF6')('  │')} ${styledLine}`, 4)
        }

        const hiddenStdout = allLines.length - outputLines.length
        if (hiddenStdout > 0) {
          await typeText(`${chalk.hex('#8B5CF6')('  │')} ${chalk.hex('#94A3B8')(`… ${hiddenStdout} more line${hiddenStdout === 1 ? '' : 's'}`)}`, 4)
        }
      }

      // on a TTY the summary was already printed live; without one nothing has
      // been shown yet, so replay the lines git meant to keep
      if (isPushStep && !process.stdout.isTTY && output.persistentLines.length > 0) {
        const shown = output.persistentLines.slice(0, maxGitSummaryLines)
        for (const line of shown) {
          await typeText(`${chalk.hex('#8B5CF6')('  │')} ${styleGitProgressLine(line)}`, 4)
        }
        const hidden = output.persistentLines.length - shown.length
        if (hidden > 0) {
          await typeText(`${chalk.hex('#8B5CF6')('  │')} ${chalk.hex('#94A3B8')(`… ${hidden} more line${hidden === 1 ? '' : 's'}`)}`, 4)
        }
      }
    } catch (error: any) {
      clearStatusLine()

      if (step.args.includes('commit') && (error.stdout || error.message || '').includes('nothing to commit')) {
        await typeText(`${chalk.hex('#F59E0B').bold('⚠️ skipped')}  ${displayLabel} ${chalk.hex('#94A3B8')('(nothing to commit, working tree clean)')}`)
        continue
      }

      await typeText(`${chalk.hex('#EF4444').bold('❌ failed')}   ${displayLabel}`)
      console.error(chalk.hex('#FCA5A5')(`\nError: Command failed: ${cmdStr}`))

      // stderr was already mirrored above while the step ran, so only repeat it
      // when nothing was streamed (no TTY, or the step failed before output)
      if (!output.progressActive) {
        console.error(chalk.hex('#FCA5A5')(`${error.stderr || error.message}\n`))
      } else {
        console.error('')
      }

      if (step.args.includes('remote') && step.args.includes('add')) {
        console.error(chalk.hex('#F59E0B')(`Tip: If remote "origin" already exists, run 'git remote remove origin' first.`))
      }
      process.exit(1)
    }
  }

  await typeText(`\n${chalk.hex('#10B981').bold('✅ Project successfully pushed to Git remote!')}`)
}
