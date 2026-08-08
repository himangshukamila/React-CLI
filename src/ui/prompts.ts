import chalk from 'chalk'
import { accent, muted, strong, section } from './banner.js'
import { OptionChoice, PromptMultiselectOptions, PromptConfirmOptions } from '../types/index.js'

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
  const box = selected ? accent('■') : muted('□')
  const diamond = selected ? strong('◆') : muted('◇')
  const label = selected ? strong(option.label) : muted(option.label)
  const hint = option.hint ? muted(`  (${option.hint})`) : ''

  return `${cursor}${box} ${diamond} ${label}${hint}`
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

  try {
    const { multiselect, isCancel } = await import('@clack/prompts')
    const res = await multiselect({
      message: message || 'Select options:',
      options: options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        hint: opt.hint,
      })),
      initialValues,
      required: false,
    })

    if (isCancel(res)) {
      console.log(chalk.hex('#94A3B8')('\nOperation cancelled\n'))
      process.exit(0)
    }

    return res as string[]
  } catch (_err) {
    return initialValues
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
      console.log(chalk.hex('#94A3B8')('\nOperation cancelled\n'))
      process.exit(0)
    }

    return Boolean(res)
  } catch (_err) {
    return false
  }
}
