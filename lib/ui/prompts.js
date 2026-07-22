import chalk from 'chalk'
import { accent, muted, strong, section } from './banner.js'

export const printControls = () => {
  const rule = chalk.hex('#6FA8DC')('═'.repeat(42))
  const key = (value) => chalk.bgHex('#6FA8DC').black.bold(` ${value} `)
  const action = (value) => chalk.whiteBright.bold(value)

  console.log(`\n${chalk.bold.hex('#FF8A5B')('CONTROLS')} ${rule}`)
  console.log(`${key('SPACE')} ${action('select')}   ${key('ENTER')} ${action('confirm')}   ${key('A')} ${action('toggle all')}`)
}

export const renderSelectOption = ({ option, selected, active }) => {
  const cursor = active ? accent('› ') : '  '
  const box = selected ? accent('■') : muted('□')
  const diamond = selected ? strong('◆') : muted('◇')
  const label = selected ? strong(option.label) : muted(option.label)
  const hint = option.hint ? muted(`  (${option.hint})`) : ''

  return `${cursor}${box} ${diamond} ${label}${hint}`
}

export const clearLines = (count) => {
  process.stdout.write(`\x1b[${count}A\x1b[J`)
}

export const createProgress = (steps) => {
  let current = 0
  let renderedLines = 0
  let frame = 0
  let timer
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
    async step(task) {
      timer = setInterval(() => {
        frame = (frame + 1) % frames.length
        render()
      }, 120)

      try {
        await task()
      } finally {
        clearInterval(timer)
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

export const customMultiselect = ({ options, initialValues = [] }) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve(initialValues)
  }

  return new Promise((resolve) => {
    const selected = new Set(initialValues)
    let activeIndex = 0
    let renderedLines = 0
    const startTime = Date.now()

    if (process.stdin.setRawMode) process.stdin.setRawMode(true)
    process.stdin.resume()

    const render = () => {
      if (renderedLines > 0) clearLines(renderedLines)

      const lines = options.map((option, index) => renderSelectOption({
        option,
        selected: selected.has(option.value),
        active: index === activeIndex,
      }))

      process.stdout.write(`${lines.join('\n')}\n`)
      renderedLines = lines.length
    }

    const done = () => {
      process.stdin.off('data', onData)
      if (process.stdin.setRawMode) process.stdin.setRawMode(false)
      clearLines(renderedLines)

      const lines = options.map((option) => renderSelectOption({
        option,
        selected: selected.has(option.value),
        active: false,
      }))

      process.stdout.write(`${lines.join('\n')}\n`)
      resolve([...selected])
    }

    const onData = (buffer) => {
      const str = buffer.toString('utf8')

      // Ctrl+C
      if (str === '\x03' || str.includes('\x03') || str.charCodeAt(0) === 3) {
        process.stdin.off('data', onData)
        if (process.stdin.setRawMode) process.stdin.setRawMode(false)
        console.log(chalk.hex('#94A3B8')('\nOperation cancelled 👋\n'))
        process.exit(0)
      }

      // Enter
      if (str === '\r' || str === '\n' || str === '\r\n') {
        if (Date.now() - startTime < 300) return
        done()
        return
      }

      // Up Arrow
      if (str === '\x1b[A' || str === '\x1bOA') {
        activeIndex = activeIndex === 0 ? options.length - 1 : activeIndex - 1
        render()
        return
      }

      // Down Arrow
      if (str === '\x1b[B' || str === '\x1bOB') {
        activeIndex = activeIndex === options.length - 1 ? 0 : activeIndex + 1
        render()
        return
      }

      // Space
      if (str === ' ') {
        const value = options[activeIndex].value
        if (selected.has(value)) selected.delete(value)
        else selected.add(value)
        render()
        return
      }

      // 'a' or 'A'
      if (str === 'a' || str === 'A') {
        if (selected.size === options.length) selected.clear()
        else options.forEach((option) => selected.add(option.value))
        render()
        return
      }
    }

    process.stdin.on('data', onData)
    render()
  })
}

export const customConfirm = ({ message, initialValue = true }) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    let value = initialValue
    let renderedLines = 0
    const startTime = Date.now()

    if (process.stdin.setRawMode) process.stdin.setRawMode(true)
    process.stdin.resume()

    const render = () => {
      if (renderedLines > 0) clearLines(renderedLines)

      const yes = value ? accent('■ yes') : muted('□ yes')
      const no = value ? muted('□ no') : accent('■ no')
      const lines = [
        `${accent('›')} ${strong(message)}`,
        `  ${yes}   ${no}   ${muted('space toggle · y/n select · enter confirm')}`,
      ]

      process.stdout.write(`${lines.join('\n')}\n`)
      renderedLines = lines.length
    }

    const done = () => {
      process.stdin.off('data', onData)
      if (process.stdin.setRawMode) process.stdin.setRawMode(false)
      clearLines(renderedLines)

      const answer = value ? accent('yes') : muted('no')
      process.stdout.write(`${accent('›')} ${strong(message)} ${answer}\n`)
      resolve(value)
    }

    const onData = (buffer) => {
      const str = buffer.toString('utf8')

      // Ctrl+C
      if (str === '\x03' || str.includes('\x03') || str.charCodeAt(0) === 3) {
        process.stdin.off('data', onData)
        if (process.stdin.setRawMode) process.stdin.setRawMode(false)
        console.log(chalk.hex('#94A3B8')('\nOperation cancelled 👋\n'))
        process.exit(0)
      }

      // Enter
      if (str === '\r' || str === '\n' || str === '\r\n') {
        if (Date.now() - startTime < 300) return
        done()
        return
      }

      const lower = str.toLowerCase()

      // 'y', Left, Up
      if (lower === 'y' || str === '\x1b[D' || str === '\x1b[A' || str === '\x1bOD' || str === '\x1bOA') {
        value = true
        render()
        return
      }

      // 'n', Right, Down
      if (lower === 'n' || str === '\x1b[C' || str === '\x1b[B' || str === '\x1bOC' || str === '\x1bOB') {
        value = false
        render()
        return
      }

      // Space or Tab
      if (str === ' ' || str === '\t') {
        value = !value
        render()
        return
      }
    }

    process.stdin.on('data', onData)
    render()
  })
}
