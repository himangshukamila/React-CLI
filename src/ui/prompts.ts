import chalk from 'chalk'
import { accent, muted, strong, section } from './banner.js'
import { OptionChoice, PromptMultiselectOptions, PromptConfirmOptions, PromptTextOptions } from '../types/index.js'

export const printControls = (): void => {
  const rule = chalk.hex('#6FA8DC')('═'.repeat(42))
  const key = (value: string) => chalk.bgHex('#6FA8DC').black.bold(` ${value} `)
  const action = (value: string) => chalk.whiteBright.bold(value)

  console.log(`\n${chalk.bold.hex('#FF8A5B')('CONTROLS')} ${rule}`)
  console.log(`${key('SPACE')} ${action('select')}   ${key('ENTER')} ${action('confirm')}   ${key('A')} ${action('toggle all')}`)
}

export interface RenderOptionParams {
  option: OptionChoice
  selected: boolean
  active: boolean
}

export const renderSelectOption = ({ option, selected, active }: RenderOptionParams): string => {
  const cursor = active ? accent('› ') : '  '
  const box = selected ? chalk.hex('#10B981')('■') : muted('□')
  const label = active || selected ? strong(option.label) : muted(option.label)
  const hint = option.hint ? chalk.hex('#94A3B8')(` (${option.hint})`) : ''

  return `${cursor}${box} ${label}${hint}`
}

export const clearLines = (count: number): void => {
  process.stdout.write(`\x1b[${count}A\x1b[J`)
}

export interface ProgressStep {
  done: string
  active: string
  pending: string
  meta?: string
}

export const createProgress = (steps: ProgressStep[]) => {
  let current = 0
  let renderedLines = 0
  let frame = 0
  let timer: NodeJS.Timeout | undefined
  const width = 34
  const frames = ['◐', '◓', '◑', '◒']

  const render = () => {
    if (renderedLines > 0) clearLines(renderedLines)

    const pct = Math.round((current / steps.length) * 100)
    const filled = Math.round((current / steps.length) * width)
    const bar = `${accent('█'.repeat(filled))}${muted('·'.repeat(width - filled))}`
    const lines = steps.map((step, index) => {
      if (index < current) return `${chalk.green('✓')} ${strong(step.done)} ${muted(step.meta || '')}`
      if (index === current) return `${accent(frames[frame])} ${strong(step.active)} ${muted(step.meta || '')}`
      return `${muted('□')} ${muted(step.pending)}`
    })

    lines.push(`${bar} ${strong(`${pct}%`)}`)
    process.stdout.write(`${lines.join('\n')}\n`)
    renderedLines = lines.length
  }

  return {
    start() {
      section('install', 'running setup pipeline')
      render()
    },
    async step(task: () => Promise<void> | void) {
      timer = setInterval(() => {
        frame = (frame + 1) % frames.length
        render()
      }, 120)

      try {
        await task()
      } finally {
        if (timer) clearInterval(timer)
        timer = undefined
      }
      current += 1
      render()
    },
    done() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      if (current < steps.length) {
        current = steps.length
        render()
      }
    },
  }
}

export const customMultiselect = async ({
  options,
  initialValues = [],
  message = 'Select options (Space to toggle, Enter to confirm):',
}: PromptMultiselectOptions): Promise<string[]> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return initialValues
  }

  const readlineModule = await import('node:readline')

  return new Promise((resolve) => {
    let cursorIndex = 0
    const selected = new Set<string>(initialValues)
    let renderedLines = 0

    const render = () => {
      if (renderedLines > 0) {
        clearLines(renderedLines)
      }

      const lines: string[] = []

      lines.push(`${accent('◆')} ${strong(message || 'Select options:')}`)

      for (let i = 0; i < options.length; i++) {
        const option = options[i]
        const isSelected = selected.has(option.value)
        const isActive = i === cursorIndex
        lines.push(renderSelectOption({ option, selected: isSelected, active: isActive }))
      }

      lines.push(muted('  (space to toggle, a to toggle all, enter to confirm)'))

      process.stdout.write(lines.join('\n') + '\n')
      renderedLines = lines.length
    }

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeyPress)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
      process.stdout.write('\x1b[?25h')
    }

    const onKeyPress = (_str: string | undefined, key: any) => {
      if (!key && !_str) return

      if ((key && key.ctrl && key.name === 'c') || (key && key.name === 'escape') || _str === '\u0003') {
        cleanup()
        console.log(chalk.hex('#94A3B8')('\nOperation cancelled ❎\n'))
        process.exit(0)
      }

      if (key && (key.name === 'up' || key.name === 'k')) {
        cursorIndex = cursorIndex === 0 ? options.length - 1 : cursorIndex - 1
        render()
      } else if (key && (key.name === 'down' || key.name === 'j')) {
        cursorIndex = cursorIndex === options.length - 1 ? 0 : cursorIndex + 1
        render()
      } else if ((key && key.name === 'space') || _str === ' ') {
        const val = options[cursorIndex].value
        if (selected.has(val)) {
          selected.delete(val)
        } else {
          selected.add(val)
        }
        render()
      } else if ((key && key.name === 'a') || _str === 'a' || _str === 'A') {
        if (selected.size === options.length) {
          selected.clear()
        } else {
          options.forEach((opt) => selected.add(opt.value))
        }
        render()
      } else if (key && (key.name === 'return' || key.name === 'enter') || _str === '\r' || _str === '\n') {
        cleanup()
        if (renderedLines > 0) {
          clearLines(renderedLines)
        }
        const selectedList = Array.from(selected)
        const selectedLabels = options
          .filter((opt) => selected.has(opt.value))
          .map((opt) => opt.label)
        const summary = selectedLabels.length > 0 ? selectedLabels.join(', ') : 'none'
        console.log(`${chalk.green('✓')} ${strong(message || 'Select options:')} ${muted(summary)}`)
        resolve(selectedList)
      }
    }

    readlineModule.emitKeypressEvents(process.stdin)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()
    process.stdin.on('keypress', onKeyPress)
    process.stdout.write('\x1b[?25l')
    render()
  })
}

export const customText = async ({
  message = 'Enter a value',
  placeholder,
  defaultValue = '',
  validate,
}: PromptTextOptions): Promise<string> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return defaultValue
  }

  try {
    const { text, isCancel } = await import('@clack/prompts')
    const res = await text({
      message,
      placeholder,
      defaultValue,
      validate: validate ? (value: string) => validate(value) : undefined,
    })

    if (isCancel(res)) {
      console.log(chalk.hex("#94A3B8")("\nOperation cancelled ❎\n"));
      process.exit(0)
    }

    const answer = typeof res === 'string' ? res.trim() : ''
    return answer || defaultValue
  } catch (_err) {
    return defaultValue
  }
}

export const customConfirm = async ({
  message = 'Confirm option?',
  initialValue = true,
}: PromptConfirmOptions): Promise<boolean> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false
  }

  try {
    const { confirm, isCancel } = await import('@clack/prompts')
    const res = await confirm({
      message: message || 'Confirm?',
      initialValue,
    })

    if (isCancel(res)) {
      console.log(chalk.hex("#94A3B8")("\nOperation cancelled ❎\n"));
      process.exit(0)
    }

    return Boolean(res)
  } catch (_err) {
    return false
  }
}
