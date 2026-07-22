import path from 'node:path'
import readline from 'node:readline'
import chalk from 'chalk'
import { execa } from 'execa'
import { section, fail, typeText } from '../ui/banner.js'
import { pathExists } from '../shared.js'

export const isSafeRemoteUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return false
  if (url.includes('::')) return false
  if (Array.from(url).some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) return false
  return /^(https?|git|ssh):\/\//i.test(url) || /^[\w.-]+@[\w.-]+:.+$/.test(url)
}

export const generateAutoCommitMessage = async () => {
  try {
    const result = await execa('git', ['status', '--porcelain'], { cwd: process.cwd(), reject: false })
    const stdout = result.stdout || ''
    const lines = stdout.trim().split('\n').filter(Boolean)

    if (lines.length === 0) {
      return 'update project files'
    }

    const modifiedFiles = []
    const addedFiles = []
    const deletedFiles = []
    const renamedFiles = []

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
      const baseName = path.basename(file)

      if (addedFiles.length === 1) return `add ${baseName}`
      if (deletedFiles.length === 1) return `remove ${baseName}`
      if (renamedFiles.length === 1) return `rename ${baseName}`
      return `update ${baseName}`
    }

    const categories = new Set()

    allChangedFiles.forEach((file) => {
      const normalized = file.replace(/\\/g, '/')
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
  } catch (error) {
    return 'update project files'
  }
}

export const gitPushWrapper = async (options) => {
  const steps = []
  let gitDirExists = await pathExists(path.join(process.cwd(), '.git'))
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
          args: ['remote', 'add', 'origin', options.github],
        },
        {
          label: 'Push branch main to origin',
          cmd: 'git',
          args: ['push', '-u', 'origin', 'main'],
        },
      )
    } else {
      const commitMessage = isFlagOnly ? autoCommitMessage : options.github
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
          args: ['push'],
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

    if (!gitDirExists) {
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
          args: ['push', '-u', 'origin', 'main'],
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
          args: ['push', '-u', 'origin', 'main'],
        },
      )
    }
  }

  section('git setup & push', gitDirExists ? 'pushing updates' : 'linking workspace to remote')

  for (const step of steps) {
    const cmdStr = `${step.cmd} ${step.args.join(' ')}`
    const displayLabel = `${chalk.bold.whiteBright(step.label)} ${chalk.hex('#38BDF8')(`(${cmdStr})`)}`
    
    process.stdout.write(`${chalk.hex('#EC4899')('⚡ running')}  ${displayLabel}...`)
    try {
      const result = await execa(step.cmd, step.args, { cwd: process.cwd() })
      
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      await typeText(`${chalk.hex('#10B981').bold('✔ success')}  ${displayLabel}`)
      
      if (result.stdout && result.stdout.trim()) {
        const outputLines = result.stdout.trim().split('\n')
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
      }
    } catch (error) {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      
      if (step.args.includes('commit') && (error.stdout || error.message || '').includes('nothing to commit')) {
        await typeText(`${chalk.hex('#F59E0B').bold('⚠ skipped')}  ${displayLabel} ${chalk.hex('#94A3B8')('(nothing to commit, working tree clean)')}`)
        continue
      }

      await typeText(`${chalk.hex('#EF4444').bold('✖ failed')}   ${displayLabel}`)
      console.error(chalk.hex('#FCA5A5')(`\nError: Command failed: ${cmdStr}`))
      console.error(chalk.hex('#FCA5A5')(`${error.stderr || error.message}\n`))
      
      if (step.args.includes('remote') && step.args.includes('add')) {
        console.error(chalk.hex('#F59E0B')(`Tip: If remote "origin" already exists, run 'git remote remove origin' first.`))
      }
      process.exit(1)
    }
  }

  await typeText(`\n${chalk.hex('#10B981').bold('✔ Project successfully pushed to Git remote! ♥︎')}`)
}
