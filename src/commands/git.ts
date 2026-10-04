import path from 'node:path'
import readline from 'node:readline'
import { stripVTControlCharacters } from 'node:util'
import chalk from 'chalk'
import stringWidth from 'string-width'
import { execa } from 'execa'
import { section, fail, typeText, accent, muted } from '../ui/banner.js'
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

const spinnerFrames = ['◐', '◓', '◑', '◒']
const progressBarWidth = 22

// format a progress bar with filled blocks and percentage
export const formatGitProgressBar = (
  label: string,
  percent: number,
  counts: string = '',
  tail: string = '',
  tick: number = Date.now(),
): string => {
  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)))
  const filled = Math.round((clampedPercent / 100) * progressBarWidth)

  const spinner = clampedPercent >= 100
    ? chalk.hex('#10B981')('✓')
    : accent(spinnerFrames[Math.floor(tick / 120) % spinnerFrames.length])
  const bar = `${accent('█'.repeat(filled))}${muted('·'.repeat(progressBarWidth - filled))}`
  const pct = chalk.hex('#38BDF8').bold(`${String(clampedPercent).padStart(3)}%`)
  const countsText = counts ? chalk.hex('#F59E0B')(` ${counts}`) : ''
  const extra = tail.replace(/^[,\s]+/, '').replace(/,\s*done\.$/, '').trim()
  const tailText = extra && (process.stdout.columns || 80) >= 100 ? chalk.hex('#94A3B8')(`  ${extra}`) : ''

  return `${spinner} ${chalk.bold.whiteBright(label.padEnd(19))} ${bar} ${pct}${countsText}${tailText}`
}

export const formatGitProgressFrame = (line: string, tick: number = Date.now()): string => {
  const match = line.match(/^(.*?):\s*(\d+)%\s*\((\d+)\/(\d+)\)(.*)$/)
  if (!match) return styleGitProgressLine(line)

  const [, label, percentText, completed, total, trailing] = match
  const percent = Math.min(100, Math.max(0, Number(percentText)))
  const counts = `(${completed}/${total})`
  return formatGitProgressBar(label, percent, counts, trailing, tick)
}

interface GitStepOutput {
  persistentLines: string[]
  progressActive: boolean
  finishProgress?: () => Promise<void>
  stopProgress?: () => void
}

const graphemes = new Intl.Segmenter()

// Leave the last terminal column empty to avoid automatic line wrapping.
export const fitGitStatusLine = (text: string, columns: number = process.stdout.columns || 80): string => {
  const width = Math.max(0, columns - 1)
  const singleLine = text.replace(/[\r\n\t]/g, ' ')
  if (width === 0) return ''
  if (stringWidth(singleLine) <= width) return singleLine

  let fitted = ''
  let used = 0
  for (const part of singleLine.split(/(\x1B\[[0-9;]*m)/g)) {
    if (part.startsWith('\x1B[')) {
      fitted += part
      continue
    }
    for (const { segment } of graphemes.segment(part)) {
      const size = stringWidth(segment)
      if (used + size > width - 1) return `${fitted}…\x1B[0m`
      fitted += segment
      used += size
    }
  }
  return fitted
}

type GitProgressStream = NodeJS.WritableStream & { isTTY?: boolean; columns?: number }

export class SmoothGitProgressTracker {
  private currentPercent = 0
  private targetPercent = 0
  private timer: NodeJS.Timeout | null = null
  private active = false
  private finishing = false
  private phase = ''
  private status = ''
  private rendered = ''
  private renderedColumns = 0

  constructor(private readonly stream: GitProgressStream = process.stdout) {}

  start(status: string) {
    this.active = true
    this.status = status
    if (!this.stream.isTTY) {
      this.stream.write(`${status}\n`)
      return
    }
    this.stream.on('resize', this.onResize)
    this.render(status)
  }

  handleLine(text: string) {
    if (!this.active || this.finishing || !this.stream.isTTY) return
    const match = text.match(/^(.*?):\s*(\d+)%\s*\(\d+\/\d+\)/)
    if (!match) return

    if (match[1] !== this.phase) {
      this.phase = match[1]
      this.currentPercent = 0
    }
    this.targetPercent = Math.min(100, Math.max(0, Number(match[2])))

    if (!this.timer) {
      this.startLoop()
    }
  }

  private startLoop() {
    if (this.timer) return
    this.timer = setInterval(() => {
      if (this.currentPercent < this.targetPercent) {
        const diff = this.targetPercent - this.currentPercent
        const step = Math.max(1, Math.ceil(diff * 0.25))
        this.currentPercent = Math.min(this.targetPercent, this.currentPercent + step)
      }
      this.draw()
    }, 60)
  }

  private onResize = () => {
    if (this.phase) this.draw()
    else this.render(this.status)
  }

  private clear() {
    if (!this.rendered) return

    // A terminal resize can reflow the previous frame onto several rows.
    const columns = this.stream.columns || 80
    let rows = 0
    let column = 0
    for (const { segment } of graphemes.segment(stripVTControlCharacters(this.rendered))) {
      const size = stringWidth(segment)
      if (column + size > columns) {
        rows += 1
        column = 0
      }
      column += size
    }
    readline.cursorTo(this.stream, 0)
    if (rows > 0) readline.moveCursor(this.stream, 0, -rows)
    readline.clearScreenDown(this.stream)
    this.rendered = ''
  }

  private render(text: string) {
    if (!this.active || !this.stream.isTTY) return
    const columns = this.stream.columns || 80
    const frame = fitGitStatusLine(text, columns)
    if (frame === this.rendered && columns === this.renderedColumns) return
    this.clear()
    this.stream.write(frame)
    this.rendered = frame
    this.renderedColumns = columns
  }

  private draw() {
    const columns = this.stream.columns || 80
    const barWidth = Math.max(4, Math.min(14, Math.floor(columns / 4)))
    const clamped = Math.min(100, Math.max(0, Math.round(this.currentPercent)))
    const filled = Math.round((clamped / 100) * barWidth)
    const bar = `${chalk.hex('#00E5FF')('█'.repeat(filled))}${chalk.hex('#475569')('·'.repeat(barWidth - filled))}`
    const pct = chalk.hex('#38BDF8').bold(`${String(clamped).padStart(3)}%`)

    const prefix = columns >= 60 ? `${chalk.hex('#EC4899')('⚡ running')}  ` : `${accent('›')} `
    const suffix = ` [${bar}] ${pct}`
    const labelColumns = columns - stringWidth(prefix + suffix)
    const label = fitGitStatusLine(this.phase, labelColumns)
    this.render(labelColumns > 1 ? `${prefix}${chalk.bold.whiteBright(label)}${suffix}` : pct)
  }

  async finish(): Promise<void> {
    if (!this.active || this.finishing) return
    this.finishing = true
    // Only one animation loop may own the terminal while finishing.
    this.stopTimer()
    this.targetPercent = 100
    try {
      if (this.phase) {
        while (this.active && this.currentPercent < 100) {
          const diff = 100 - this.currentPercent
          const step = Math.max(2, Math.ceil(diff * 0.35))
          this.currentPercent = Math.min(100, this.currentPercent + step)
          this.draw()
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
        if (this.active) await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } finally {
      this.stop()
    }
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  stop() {
    this.active = false
    this.stopTimer()
    this.stream.removeListener('resize', this.onResize)
    this.clear()
  }

  get isProgressActive() {
    return Boolean(this.phase)
  }
}

const attachGitOutput = (
  child: { stderr?: NodeJS.ReadableStream | null },
  tracker: SmoothGitProgressTracker,
): GitStepOutput => {
  const state: GitStepOutput = {
    persistentLines: [],
    get progressActive() {
      return tracker.isProgressActive
    },
    finishProgress: () => tracker.finish(),
    stopProgress: () => tracker.stop(),
  }
  if (!child.stderr) return state

  let buffer = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    const { lines, rest } = parseGitOutputChunk(buffer + chunk)
    buffer = rest

    for (const { text, persistent } of lines) {
      if (persistent) {
        state.persistentLines.push(text)
      }
      tracker.handleLine(text)
    }
  })

  return state
}

export interface GitPushOptions {
  github?: string | boolean
  git?: string | boolean
  message?: string
}

export const gitPushWrapper = async (options: GitPushOptions): Promise<void> => {
  const steps: { label: string; cmd: string; args: string[] }[] = []
  const gitDirExists = await pathExists(path.join(process.cwd(), '.git'))
  const autoCommitMessage = await generateAutoCommitMessage()

  // validate if git flag was provided without a url
  if (options.git === true) {
    fail('Please provide a remote URL: anshh push --git <url>')
  }

  // resolve remote repository url from git or github options
  let remoteUrl: string | undefined
  if (typeof options.git === 'string' && options.git.trim()) {
    remoteUrl = options.git.trim()
  } else if (
    typeof options.github === 'string' &&
    (/^(https?:\/\/|git@|git:\/\/)/.test(options.github) || options.github.endsWith('.git'))
  ) {
    remoteUrl = options.github.trim()
  }

  // resolve commit message from message flag or github text argument
  let commitMessage: string
  if (typeof options.message === 'string' && options.message.trim()) {
    commitMessage = options.message.trim()
  } else if (typeof options.github === 'string' && !remoteUrl) {
    commitMessage = options.github.trim()
  } else {
    commitMessage = autoCommitMessage
  }

  if (remoteUrl) {
    if (!isSafeRemoteUrl(remoteUrl)) {
      fail('Unsafe git remote URL. Use an https://, ssh://, git:// or git@host:path URL.')
    }

    if (!gitDirExists) {
      steps.push(
        {
          label: 'Initialize Git repository',
          cmd: 'git',
          args: ['init'],
        },
        {
          label: `Add remote origin (${remoteUrl})`,
          cmd: 'git',
          args: ['remote', 'add', 'origin', remoteUrl],
        },
      )
    } else {
      // check if remote origin already exists in local repository
      let hasOrigin = false
      try {
        const remotesRes = await execa('git', ['remote'], { cwd: process.cwd(), reject: false })
        const existingRemotes = (remotesRes.stdout || '').split('\n').map((r) => r.trim()).filter(Boolean)
        hasOrigin = existingRemotes.includes('origin')
      } catch {}

      if (hasOrigin) {
        steps.push({
          label: `Update remote origin (${remoteUrl})`,
          cmd: 'git',
          args: ['remote', 'set-url', 'origin', remoteUrl],
        })
      } else {
        steps.push({
          label: `Add remote origin (${remoteUrl})`,
          cmd: 'git',
          args: ['remote', 'add', 'origin', remoteUrl],
        })
      }
    }

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
        label: 'Ensure main branch',
        cmd: 'git',
        args: ['branch', '-M', 'main'],
      },
      {
        label: 'Push branch main to origin',
        cmd: 'git',
        args: ['push', '--progress', '-u', 'origin', 'main'],
      },
    )
  } else {
    if (!gitDirExists) {
      fail('Error: This directory is not a Git repository. Please initialize it by providing the remote URL: anshh push --git <url>')
    }

    // verify repository has remote origin configured
    let hasOrigin = false
    try {
      const remotesRes = await execa('git', ['remote'], { cwd: process.cwd(), reject: false })
      const existingRemotes = (remotesRes.stdout || '').split('\n').map((r) => r.trim()).filter(Boolean)
      hasOrigin = existingRemotes.includes('origin')
    } catch {}

    if (!hasOrigin) {
      fail('Error: Remote "origin" is not configured. Please specify the remote URL: anshh push --git <url>')
    }

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

  section('git setup & push', gitDirExists ? 'pushing updates' : 'linking workspace to remote')

  for (const step of steps) {
    const cmdStr = `${step.cmd} ${step.args.join(' ')}`
    const displayLabel = `${chalk.bold.whiteBright(step.label)} ${chalk.hex('#38BDF8')(`(${cmdStr})`)}`

    const isPushStep = step.args.includes('push')
    let output: GitStepOutput = { persistentLines: [], progressActive: false }
    const tracker = new SmoothGitProgressTracker()

    try {
      tracker.start(`${chalk.hex('#EC4899')('⚡ running')}  ${displayLabel}...`)
      const child = execa(step.cmd, step.args, { cwd: process.cwd() })
      output = attachGitOutput(child, tracker)
      const result = await child

      if (output.finishProgress) {
        await output.finishProgress()
      }

      tracker.stop()
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

      // type out the lines git wanted kept, matching the rest of the push output
      if (isPushStep && output.persistentLines.length > 0) {
        // filter out raw object counting and writing lines so they do not duplicate the progress bar
        const filteredLines = output.persistentLines.filter(
          (line) => !/^(Counting|Compressing|Writing)\s+objects/i.test(line.trim())
        )
        const shown = filteredLines.slice(0, maxGitSummaryLines)
        for (const line of shown) {
          await typeText(`${chalk.hex('#8B5CF6')('  │')} ${styleGitProgressLine(line)}`, 4)
        }
        const hidden = filteredLines.length - shown.length
        if (hidden > 0) {
          await typeText(`${chalk.hex('#8B5CF6')('  │')} ${chalk.hex('#94A3B8')(`… ${hidden} more line${hidden === 1 ? '' : 's'}`)}`, 4)
        }
      }
    } catch (error: any) {
      if (output.stopProgress) {
        output.stopProgress()
      }
      tracker.stop()

      if (step.args.includes('commit') && (error.stdout || error.message || '').includes('nothing to commit')) {
        await typeText(`${chalk.hex('#F59E0B').bold('⚠️ skipped')}  ${displayLabel} ${chalk.hex('#94A3B8')('(nothing to commit, working tree clean)')}`)
        continue
      }

      await typeText(`${chalk.hex('#EF4444').bold('❌ failed')}   ${displayLabel}`)
      console.error(chalk.hex('#FCA5A5')(`\nError: Command failed: ${cmdStr}`))

      // git's own message was buffered, so type it out rather than dumping it
      if (output.persistentLines.length > 0) {
        for (const line of output.persistentLines.slice(0, maxGitSummaryLines)) {
          await typeText(`${chalk.hex('#8B5CF6')('  │')} ${chalk.hex('#FCA5A5')(line)}`, 4)
        }
        console.error('')
      } else {
        console.error(chalk.hex('#FCA5A5')(`${error.stderr || error.message}\n`))
      }

      if (step.args.includes('remote') && step.args.includes('add')) {
        console.error(chalk.hex('#F59E0B')(`Tip: If remote "origin" already exists, run 'git remote remove origin' first.`))
      }
      process.exit(1)
    }
  }

  await typeText(`\n${chalk.hex('#10B981').bold('✅ Project successfully pushed to Git remote!')}`)
}
