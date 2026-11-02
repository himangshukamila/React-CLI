import test from 'node:test'
import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'
import stringWidth from 'string-width'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { normalizeUiSelections } from '../src/commands/wizard.js'

test('normalizeUiSelections parses valid project name and options', () => {
  const result = normalizeUiSelections({
    projectName: 'my-custom-app',
    packages: ['tailwind', 'axios', 'zod'],
    structure: ['components', 'pages'],
    launch: ['runDevServer'],
    devServerPort: '5173',
  })

  assert.equal(result.projectName, 'my-custom-app')
  assert.deepEqual(result.selectedPackages, ['tailwind', 'axios', 'zod'])
  assert.deepEqual(result.selectedFolders, ['components', 'pages'])
  assert.equal(result.shouldRunDevServer, true)
  assert.equal(result.devServerPort, 5173)
})

test('normalizeUiSelections parses bonjour in launch choices', () => {
  const result = normalizeUiSelections({
    projectName: 'my-bonjour-app',
    packages: ['tailwind'],
    structure: ['components', 'pages'],
    launch: ['runDevServer', 'bonjour'],
    devServerPort: '5173',
  })

  assert.ok(result.selectedSetup.includes('bonjour'))
  assert.equal(result.shouldRunDevServer, true)
})

test('normalizeUiSelections rejects invalid project name format', () => {
  assert.throws(
    () => {
      normalizeUiSelections({
        projectName: '../invalid-path',
      })
    },
    /Invalid project name/,
  )
})

test('getBasePackageName and resolvePackageName handle versioned and scoped packages', async () => {
  const { getBasePackageName, resolvePackageName } = await import('../src/shared.js')

  assert.equal(getBasePackageName('react@18.3.1'), 'react')
  assert.equal(getBasePackageName('@tailwindcss/vite@latest'), '@tailwindcss/vite')
  assert.equal(getBasePackageName('tailwind@latest'), 'tailwind')
  assert.equal(getBasePackageName('zod@latest'), 'zod')

  assert.equal(resolvePackageName('tailwind@latest'), 'tailwindcss@latest')
  assert.equal(resolvePackageName('react@18.3.1'), 'react@18.3.1')
  assert.equal(resolvePackageName('@tailwindcss/vite'), '@tailwindcss/vite')
  assert.equal(resolvePackageName('zod'), 'zod')
  assert.equal(resolvePackageName('toast'), 'ztoast')
  assert.equal(resolvePackageName('toast@latest'), 'ztoast@latest')
})

test('form generator helpers parse fields and input types correctly', async () => {
  const { extractRawFormFields, getFieldInputType, formatFieldLabel } = await import('../src/generators/form.js')

  assert.deepEqual(extractRawFormFields(['--form', 'name', 'user_email', 'phone']), ['name', 'user_email', 'phone'])
  assert.equal(getFieldInputType('password'), 'password')
  assert.equal(getFieldInputType('user_email'), 'email')
  assert.equal(getFieldInputType('phone'), 'tel')
  assert.equal(formatFieldLabel('user_email'), 'User Email')
})

test('validateDevServerPort accepts usable ports and rejects the rest', async () => {
  const { validateDevServerPort } = await import('../src/shared.js')

  for (const port of ['5173', '3000', '8080', '1024', '65535']) {
    assert.equal(validateDevServerPort(port), undefined, `${port} should be accepted`)
  }

  assert.match(String(validateDevServerPort('')), /Enter a port number/)
  assert.match(String(validateDevServerPort('abc')), /digits only/)
  assert.match(String(validateDevServerPort('51.73')), /digits only/)
  assert.match(String(validateDevServerPort('0')), /between 1 and 65535/)
  assert.match(String(validateDevServerPort('70000')), /between 1 and 65535/)
  assert.match(String(validateDevServerPort('80')), /reserved for system services/)
  assert.match(String(validateDevServerPort('1023')), /reserved for system services/)
  assert.match(String(validateDevServerPort('6000')), /Browsers block/)
})

test('normalizeUiSelections rejects a browser-blocked dev server port', async () => {
  assert.throws(
    () => normalizeUiSelections({ projectName: 'app', devServerPort: '6000' }),
    /Browsers block port 6000/,
  )
})

test('parseGitOutputChunk separates transient progress from final lines', async () => {
  const { parseGitOutputChunk } = await import('../src/commands/git.js')

  // git ends progress updates with \r and messages it wants kept with \n
  const { lines, rest } = parseGitOutputChunk(
    'Counting objects:   1% (1/87)\rCounting objects: 100% (87/87), done.\nWriting objects:  45% (39/87)\r',
  )

  assert.deepEqual(lines, [
    { text: 'Counting objects:   1% (1/87)', persistent: false },
    { text: 'Counting objects: 100% (87/87), done.', persistent: true },
    { text: 'Writing objects:  45% (39/87)', persistent: false },
  ])
  assert.equal(rest, '')
})

test('parseGitOutputChunk carries a split line into the next chunk', async () => {
  const { parseGitOutputChunk } = await import('../src/commands/git.js')

  const first = parseGitOutputChunk('Writing objects:  45% (39/')
  assert.deepEqual(first.lines, [])
  assert.equal(first.rest, 'Writing objects:  45% (39/')

  const second = parseGitOutputChunk(`${first.rest}87)\r`)
  assert.deepEqual(second.lines, [{ text: 'Writing objects:  45% (39/87)', persistent: false }])
  assert.equal(second.rest, '')
})

test('formatGitProgressFrame draws a bar for progress and leaves other lines alone', async () => {
  const { formatGitProgressFrame } = await import('../src/commands/git.js')
  const plain = (value: string) => value.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')

  const half = plain(formatGitProgressFrame('Writing objects:  50% (307/614)', 0))
  assert.match(half, /Writing objects/)
  assert.match(half, /50% \(307\/614\)/)
  assert.equal((half.match(/█/g) || []).length, 11)
  assert.equal((half.match(/·/g) || []).length, 11)

  // a finished phase swaps the spinner for a tick and fills the bar
  const done = plain(formatGitProgressFrame('Counting objects: 100% (615/615), done.', 0))
  assert.match(done, /^✓/)
  assert.equal((done.match(/·/g) || []).length, 0)

  // lines without a percentage are passed through untouched
  const other = plain(formatGitProgressFrame('Delta compression using up to 8 threads', 0))
  assert.equal(other, 'Delta compression using up to 8 threads')
})

test('git status fits narrow terminals without splitting colored or Unicode text', async () => {
  const { fitGitStatusLine } = await import('../src/commands/git.js')
  const statuses = [
    '⚡ running  Push branch main to origin (git push --progress -u origin main)...',
    `\x1b[35m⚡ running\x1b[0m  Create commit: "${'更新 👩🏽‍💻 café '.repeat(20)}"`,
    'Create commit: "first line\nsecond line\tmore text"',
  ]

  for (const columns of [1, 8, 20, 40, 60, 80, 120]) {
    for (const status of statuses) {
      const fitted = fitGitStatusLine(status, columns)
      const plain = stripVTControlCharacters(fitted)
      assert.ok(stringWidth(fitted) < columns, `${columns}-column status wrapped: ${plain}`)
      assert.doesNotMatch(plain, /[\r\n\t\uFFFD]/)
      assert.doesNotMatch(plain, /\p{Surrogate}/u)
    }
  }

  const short = '\x1b[35mStage all files\x1b[0m'
  assert.equal(fitGitStatusLine(short, 80), short)
  assert.equal(stripVTControlCharacters(fitGitStatusLine('👩🏽‍💻'.repeat(10), 6)), '👩🏽‍💻👩🏽‍💻…')
})

test('git progress stays within one row, handles resize and resets for the next phase', async () => {
  const { SmoothGitProgressTracker } = await import('../src/commands/git.js')
  const writes: string[] = []
  const frames: string[] = []
  const stream = Object.assign(new Writable({
    write(chunk, _encoding, callback) {
      const text = chunk.toString()
      writes.push(text)
      if (stripVTControlCharacters(text)) {
        frames.push(stripVTControlCharacters(text))
        assert.ok(stringWidth(text) < stream.columns, `Live status wrapped at ${stream.columns} columns`)
        assert.doesNotMatch(text, /[\r\n]/)
      }
      callback()
    },
  }), { isTTY: true, columns: 80 })
  const tracker = new SmoothGitProgressTracker(stream)

  try {
    tracker.start(`⚡ running  Create commit: "${'long commit message '.repeat(12)}"`)
    const beforeResize = writes.length
    stream.columns = 32
    stream.emit('resize')
    // The old 79-column frame reflows to three rows and all must be erased.
    assert.match(writes.slice(beforeResize).join(''), /\x1b\[2A/)
    assert.match(writes.slice(beforeResize).join(''), /\x1b\[0J/)

    tracker.handleLine('Counting objects: 80% (80/100)')
    await delay(150)
    assert.match(frames.at(-1) || '', /Counting/)
    assert.ok(Number(frames.at(-1)?.match(/(\d+)%/)?.[1]) > 5)

    tracker.handleLine('Writing objects: 5% (5/100)')
    await delay(150)
    const writing = frames.at(-1) || ''
    assert.match(writing, /Writing/)
    assert.ok(Number(writing.match(/(\d+)%/)?.[1]) <= 5)

    for (const columns of [20, 40, 60, 80, 120]) {
      stream.columns = columns
      stream.emit('resize')
      assert.match(frames.at(-1) || '', /\d+%$/)
    }

    await tracker.finish()
    assert.match(frames.at(-1) || '', /100%$/)
    assert.equal(stream.listenerCount('resize'), 0)
    const afterFinish = writes.length
    tracker.handleLine('remote: Resolving deltas: 50% (1/2)')
    stream.emit('resize')
    await delay(100)
    assert.equal(writes.length, afterFinish, 'Progress must not overwrite the typed result')
  } finally {
    tracker.stop()
    stream.destroy()
  }
})

test('stopping git progress cancels redraws even during the completion animation', async () => {
  const { SmoothGitProgressTracker } = await import('../src/commands/git.js')
  const writes: string[] = []
  const stream = Object.assign(new Writable({
    write(chunk, _encoding, callback) {
      writes.push(chunk.toString())
      callback()
    },
  }), { isTTY: true, columns: 40 })
  const tracker = new SmoothGitProgressTracker(stream)

  try {
    tracker.start('⚡ running  Push branch main to origin')
    tracker.handleLine('Writing objects: 10% (1/10)')
    const finishing = tracker.finish()
    tracker.stop()
    const afterStop = writes.length
    tracker.handleLine('Writing objects: 90% (9/10)')
    stream.emit('resize')
    await finishing
    await delay(100)
    assert.equal(writes.length, afterStop)
    assert.equal(stream.listenerCount('resize'), 0)
  } finally {
    tracker.stop()
    stream.destroy()
  }
})

test('git progress writes one plain status when output is redirected', async () => {
  const { SmoothGitProgressTracker } = await import('../src/commands/git.js')
  const writes: string[] = []
  const stream = Object.assign(new Writable({
    write(chunk, _encoding, callback) {
      writes.push(chunk.toString())
      callback()
    },
  }), { isTTY: false, columns: 40 })
  const tracker = new SmoothGitProgressTracker(stream)

  try {
    tracker.start('running push')
    tracker.handleLine('Writing objects: 50% (1/2)')
    await tracker.finish()
    assert.deepEqual(writes, ['running push\n'])
    assert.equal(stream.listenerCount('resize'), 0)
  } finally {
    tracker.stop()
    stream.destroy()
  }
})

test('buildSectionHeader keeps every header on one line', async () => {
  const { buildSectionHeader } = await import('../src/ui/banner.js')

  const headers: [string, string][] = [
    ['MODULES', 'select packages and project features'],
    ['BONJOUR SERVICE', 'configure mDNS local network service discovery'],
    ['CUSTOM LOG VIEW', 'in-app console panel for browser logs'],
    ['GIT SETUP & PUSH', 'pushing updates'],
    ['PROJECT', ''],
  ]

  for (const columns of [40, 60, 80, 100, 200]) {
    for (const [label, meta] of headers) {
      const { head, rule, tail } = buildSectionHeader(label, meta, columns)
      const rendered = `${head} ${rule}${tail ? ` ${tail}` : ''}`
      assert.ok(
        rendered.length <= Math.min(100, Math.max(40, columns)),
        `"${label}" is ${rendered.length} wide at ${columns} columns`,
      )
      assert.ok(rule.length >= 3, `"${label}" lost its rule at ${columns} columns`)
    }
  }

  // an over-long meta is trimmed rather than pushed onto a second line
  const narrow = buildSectionHeader('BONJOUR SERVICE', 'configure mDNS local network service discovery', 60)
  assert.ok(narrow.tail.endsWith('…'))
})

const viteEntry = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
`

test('addLogscanBootstrap starts logscan before render without touching the render call', async () => {
  const { addLogscanBootstrap } = await import('../src/generators/logscan.js')

  const { source, status } = addLogscanBootstrap(viteEntry)
  assert.equal(status, 'added')
  assert.match(source, /mountLogScanner\(\{ visible: true \}\)/)
  assert.ok(source.indexOf('mountLogScanner') < source.indexOf('createRoot(document'), 'bootstrap runs before render')
  assert.ok(source.includes(viteEntry.slice(viteEntry.indexOf('createRoot('))), 'render call left intact')

  assert.equal(addLogscanBootstrap(source).status, 'present')
  // logscan says not to mount both integrations in one app
  assert.equal(addLogscanBootstrap(viteEntry.replace('<App />', '<App /><LogScanner visible />')).status, 'legacy')
})

test('removeLogscanBootstrap removes the logscan bootstrap cleanly from entry file', async () => {
  const { addLogscanBootstrap, removeLogscanBootstrap } = await import('../src/generators/logscan.js')

  const { source: addedSource } = addLogscanBootstrap(viteEntry)
  assert.ok(addedSource.includes('mountLogScanner'))

  const { source: removedSource, status } = removeLogscanBootstrap(addedSource)
  assert.equal(status, 'removed')
  assert.ok(!removedSource.includes('mountLogScanner'))
  assert.ok(!removedSource.includes('logscan'))
  assert.ok(removedSource.includes('createRoot('))

  // removing when absent returns status absent
  const { status: absentStatus } = removeLogscanBootstrap(viteEntry)
  assert.equal(absentStatus, 'absent')
})

test('mountAdminTrigger renders the trigger once, inside MdnsProvider', async () => {
  const { mountAdminTrigger } = await import('../src/generators/bonjour.js')

  const wrapped = `import { MdnsProvider } from '4b-react-mdns/react'
createRoot(el).render(
  <MdnsProvider launcher={false}>
    <App />
  </MdnsProvider>
)
`
  const { source, status } = mountAdminTrigger(wrapped)
  assert.equal(status, 'added')
  assert.ok(source.indexOf('<BonjourAdminTrigger />') < source.indexOf('</MdnsProvider>'))
  assert.ok(source.indexOf('<BonjourAdminTrigger />') > source.indexOf('<MdnsProvider'))
  assert.match(source, /from '4b-react-mdns\/react'\nimport BonjourAdminTrigger from/)
  assert.equal(mountAdminTrigger(source).status, 'present')

  // a one-line provider gets the trigger inline rather than outside the tag
  const inline = mountAdminTrigger('render(<MdnsProvider><App /></MdnsProvider>)').source
  assert.match(inline, /<App \/><BonjourAdminTrigger \/><\/MdnsProvider>/)

  assert.equal(mountAdminTrigger(viteEntry).status, 'no-provider')
})

test('registerAllCommands correctly registers all modular commands', async () => {
  const { Command } = await import('commander')
  const { registerAllCommands } = await import('../src/commands/cli/index.js')

  const program = new Command()
  program.name('react')

  registerAllCommands(program)

  const commandNames = program.commands.map((cmd) => cmd.name())
  const expectedCommands = ['zecron', 'list', 'audit', 'update', 'run', 'build', 'open', 'set', 'make', 'push', 'remove', 'get']

  for (const name of expectedCommands) {
    assert.ok(commandNames.includes(name), `Command ${name} should be registered`)
  }
  assert.ok(!commandNames.includes('doctor'), 'doctor command should not be registered')
  assert.ok(!commandNames.includes('env'), 'env command should not be registered')
  assert.ok(!commandNames.includes('watch'), 'watch command should not be registered')
  assert.ok(!commandNames.includes('asset'), 'asset command should not be registered')
})

test('customMultiselect and customConfirm return default fallback values in non-TTY mode', async () => {
  const { customMultiselect, customConfirm } = await import('../src/ui/prompts.js')

  const multiselectResult = await customMultiselect({
    options: [{ value: 'tailwind', label: 'Tailwind' }],
    initialValues: ['tailwind'],
  })
  assert.deepEqual(multiselectResult, ['tailwind'])

  const confirmResult = await customConfirm({
    message: 'Test confirm?',
    initialValue: true,
  })
  assert.equal(typeof confirmResult, 'boolean')
})

test('customMultiselect handles arrow navigation, space toggle, and enter confirmation', async () => {
  const { customMultiselect } = await import('../src/ui/prompts.js')
  const originalStdinIsTTY = process.stdin.isTTY
  const originalStdoutIsTTY = process.stdout.isTTY
  const originalSetRawMode = process.stdin.setRawMode

  process.stdin.isTTY = true
  process.stdout.isTTY = true
  process.stdin.setRawMode = () => (process.stdin as any)

  const multiselectPromise = customMultiselect({
    options: [
      { value: 'pkg1', label: 'Package 1' },
      { value: 'pkg2', label: 'Package 2' },
    ],
    initialValues: ['pkg1'],
  })

  // simulate user pressing down arrow then space then enter
  process.nextTick(() => {
    process.stdin.emit('keypress', undefined, { name: 'down' })
    process.stdin.emit('keypress', ' ', { name: 'space' })
    process.stdin.emit('keypress', '\r', { name: 'return' })
  })

  const result = await multiselectPromise

  process.stdin.isTTY = originalStdinIsTTY
  process.stdout.isTTY = originalStdoutIsTTY
  process.stdin.setRawMode = originalSetRawMode
  process.stdin.pause()

  assert.deepEqual(result.sort(), ['pkg1', 'pkg2'])
})

test('countRenderedRows measures row heights accurately including wrapped lines', async () => {
  const { countRenderedRows } = await import('../src/ui/prompts.js')

  assert.equal(countRenderedRows(['hello', 'world'], 80), 2)
  assert.equal(countRenderedRows(['a'.repeat(50)], 20), 3)
  assert.equal(countRenderedRows([''], 80), 1)
})

test('customMultiselect windows options to fit small terminal heights without duplicates', async () => {
  const { customMultiselect } = await import('../src/ui/prompts.js')
  const originalStdinIsTTY = process.stdin.isTTY
  const originalStdoutIsTTY = process.stdout.isTTY
  const originalSetRawMode = process.stdin.setRawMode
  const originalRows = process.stdout.rows
  const originalColumns = process.stdout.columns

  process.stdin.isTTY = true
  process.stdout.isTTY = true
  process.stdin.setRawMode = () => (process.stdin as any)
  process.stdout.rows = 8
  process.stdout.columns = 80

  const options = Array.from({ length: 10 }, (_, i) => ({
    value: `opt${i}`,
    label: `Option ${i}`,
  }))

  const multiselectPromise = customMultiselect({
    options,
    initialValues: ['opt0'],
  })

  // navigate down multiple times across window boundary toggle and confirm
  process.nextTick(() => {
    process.stdin.emit('keypress', undefined, { name: 'down' })
    process.stdin.emit('keypress', undefined, { name: 'down' })
    process.stdin.emit('keypress', undefined, { name: 'down' })
    process.stdin.emit('keypress', undefined, { name: 'down' })
    process.stdin.emit('keypress', ' ', { name: 'space' })
    process.stdin.emit('keypress', '\r', { name: 'return' })
  })

  const result = await multiselectPromise

  process.stdin.isTTY = originalStdinIsTTY
  process.stdout.isTTY = originalStdoutIsTTY
  process.stdin.setRawMode = originalSetRawMode
  process.stdout.rows = originalRows
  process.stdout.columns = originalColumns
  process.stdin.pause()

  assert.deepEqual(result.sort(), ['opt0', 'opt4'])
})

test('configureBonjourBoilerplate is exported as a function', async () => {
  const { configureBonjourBoilerplate, mdnsPackageName } = await import('../src/generators/bonjour.js')
  assert.equal(typeof configureBonjourBoilerplate, 'function')
  assert.equal(mdnsPackageName, '4b-react-mdns')
})

test('escapeHtml safely encodes special markup characters', async () => {
  const { escapeHtml } = await import('../src/commands/wizard.js')

  assert.equal(escapeHtml('my-app'), 'my-app')
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  assert.equal(escapeHtml("project's \"name\" & more"), 'project&#039;s &quot;name&quot; &amp; more')
})

test('readSetupUiIcon rejects names outside the bundled icon allowlist', async () => {
  const { readSetupUiIcon } = await import('../src/commands/wizard.js')

  for (const name of ['', 'unknown', 'TAILWIND', 'tailwind.png', '../style', '../../package.json', '/tailwind', 'tailwind\\..\\style', '%2e%2e%2fstyle', '__proto__', 'constructor', 'tailwind\0']) {
    assert.equal(await readSetupUiIcon(name), undefined, name)
  }
})

test('readSetupUiIcon returns binary PNG data for every wizard choice', async () => {
  const { readSetupUiIcon } = await import('../src/commands/wizard.js')
  const { packageOptions, folderOptions, setupLaunchChoices } = await import('../src/ui/banner.js')
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  for (const { value } of [...packageOptions, ...folderOptions, ...setupLaunchChoices]) {
    const icon = await readSetupUiIcon(value)
    assert.ok(Buffer.isBuffer(icon), `${value} must have a bundled icon`)
    assert.deepEqual(icon.subarray(0, 8), signature, `${value} must remain valid binary PNG data`)
  }
})

test('createSetupUiHtml safely embeds project names with quotes and special characters', async () => {
  const { createSetupUiHtml } = await import('../src/commands/wizard.js')

  const html = await createSetupUiHtml({
    displayName: 'my-"custom"-app',
    token: 'testtoken123',
    submitUrl: 'http://127.0.0.1:4317/api/setup',
    timeLeftMs: 600000,
  })

  assert.ok(html.includes('const TEMPLATE_PROJECT_NAME = "my-\\"custom\\"-app";'))
  assert.ok(html.includes('&quot;custom&quot;'))
})

test('browser wizard choices match the selections accepted by the CLI', async () => {
  const ts = await import('typescript')
  const { readTemplate } = await import('../src/shared.js')
  const { packageOptions, folderOptions, setupLaunchChoices } = await import('../src/ui/banner.js')
  const html = await readTemplate('setup-ui', 'index.html')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const source = ts.createSourceFile('wizard.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const declarations = source.statements.filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
  const choices: Record<string, string[]> = {}
  for (const [name, accepted] of [['packages', packageOptions], ['structure', folderOptions], ['launchOptions', setupLaunchChoices]] as const) {
    const initializer = declarations.find((declaration) => declaration.name.getText(source) === name)?.initializer
    assert.ok(initializer)
    const items = runInNewContext('(' + initializer.getText(source) + ')') as { value: string }[]
    choices[name] = Array.from(items, (item) => item.value)
    assert.deepEqual([...choices[name]].sort(), accepted.map((item) => item.value).sort())
  }
  const selections = normalizeUiSelections({ projectName: 'wizard-check', packages: choices.packages, structure: choices.structure, launch: choices.launchOptions, devServerPort: '5173' })
  assert.equal(selections.selectedPackages.length, packageOptions.length)
  assert.equal(selections.shouldRunDevServer, true)
})

test('configureWrapper is exported and wrapperContent includes dynamic bg and children props', async () => {
  const { configureWrapper } = await import('../src/generators/wrapper.js')
  const { wrapperContent } = await import('../src/shared.js')

  assert.equal(typeof configureWrapper, 'function')
  assert.ok(wrapperContent.includes('const Wrapper = ({'))
  assert.ok(wrapperContent.includes('children'))
  assert.ok(wrapperContent.includes("bg = '/images/bg.webp'"))
  assert.ok(wrapperContent.includes('export default Wrapper'))
})

test('configureButton is exported and buttonContent provides simple styling, icon, and click props', async () => {
  const { configureButton } = await import('../src/generators/button.js')
  const { buttonContent } = await import('../src/shared.js')

  assert.equal(typeof configureButton, 'function')
  assert.ok(!buttonContent.includes('lucide-react'), 'button should not depend on lucide-react')
  assert.ok(buttonContent.includes('height'))
  assert.ok(buttonContent.includes('width'))
  assert.ok(buttonContent.includes('font'))
  assert.ok(buttonContent.includes('textSize'))
  assert.ok(buttonContent.includes('bgColor'))
  assert.ok(buttonContent.includes('textColor'))
  assert.ok(buttonContent.includes('border'))
  assert.ok(buttonContent.includes('borderColor'))
  assert.ok(buttonContent.includes('icon'))
  assert.ok(buttonContent.includes('position'))
  assert.ok(buttonContent.includes('onClick'))
  assert.ok(buttonContent.includes('disabled'))
  assert.ok(!buttonContent.includes('textsize'))
  assert.ok(!buttonContent.includes('textcolor'))
  assert.ok(!buttonContent.includes('bordercolor'))
  assert.ok(buttonContent.includes('fontFamily: font'))
  assert.ok(buttonContent.includes('fontSize: textSize'))
  assert.ok(buttonContent.includes('backgroundColor: bgColor'))
  assert.ok(buttonContent.includes('color: textColor'))
})

test('readBinaryFontMeta and parseFontInfo accurately extract font weights and families', async () => {
  const { readBinaryFontMeta, parseFontInfo } = await import('../src/generators/assets.js')

  // test standard filename parsing fallback
  const parsed = parseFontInfo('public/fonts/Custom-Bold.ttf')
  assert.equal(parsed.weight, 700)
  assert.equal(parsed.fontFamily, 'Custom-b')

  // test binary metadata reader if system font exists
  const systemFont = '/System/Library/Fonts/Geneva.ttf'
  const exists = await (await import('node:fs')).promises.access(systemFont).then(() => true).catch(() => false)
  if (exists) {
    const meta = readBinaryFontMeta(systemFont)
    assert.ok(meta)
    assert.equal(meta.family, 'Geneva')
    assert.equal(meta.weight, 400)
  }
})

test('generateApiFileContent creates clean axios wrapper with requested methods', async () => {
  const { generateApiFileContent } = await import('../src/shared.js')

  // test generation with get, post, del, and put
  const content = generateApiFileContent(['get', 'post', 'del', 'put'])

  assert.ok(content.includes("import axios from 'axios'"))
  assert.ok(content.includes('const API = axios.create'))
  assert.ok(content.includes('get: (url, config = {}) => API.get(url, config)'))
  assert.ok(content.includes('post: (url, data, config = {}) => API.post(url, data, config)'))
  assert.ok(content.includes('put: (url, data, config = {}) => API.put(url, data, config)'))
  assert.ok(content.includes('del: (url, config = {}) => API.delete(url, config)'))
  assert.ok(content.includes('delete: (url, config = {}) => API.delete(url, config)'))
  assert.ok(!content.includes('patch:'))
  assert.ok(!content.includes('ztoast'))
  assert.ok(!content.includes('getHumanReadableError'))
  assert.ok(!content.includes('unwrap('))
})

test('socketContent configures reconnection options, connect/disconnect logs, and reconnect handler', async () => {
  const { socketContent } = await import('../src/shared.js')

  // verify socket.io-client import, options, and exports
  assert.ok(socketContent.includes("import { io } from 'socket.io-client'"))
  assert.ok(socketContent.includes('export const socket = io(serverUrl,'))
  assert.ok(socketContent.includes('reconnection: true'))
  assert.ok(socketContent.includes('reconnectionAttempts: 5'))
  assert.ok(socketContent.includes('reconnectionDelay: 1000'))
  assert.ok(socketContent.includes('timeout: 10000'))
  assert.ok(socketContent.includes('io server disconnect'))
  assert.ok(socketContent.includes('socket.connect()'))
  assert.ok(socketContent.includes('export default socket'))
  assert.ok(socketContent.includes("console.log('socket connected:', socket.id)"))
  assert.ok(socketContent.includes("console.log('socket disconnected:', reason)"))
})

test('generateSocketFileContent with bonjour enables dynamic bonjour ip synchronization and logs', async () => {
  const { generateSocketFileContent } = await import('../src/shared.js')

  // test bonjour dynamic socket synchronization
  const content = generateSocketFileContent({ bonjour: true })
  assert.ok(content.includes("import { getWsBaseUrl } from './bonjour.js'"))
  assert.ok(content.includes('syncSocketWithBonjour()'))
  assert.ok(content.includes('socket.io.uri = nextUrl'))
  assert.ok(content.includes("window.addEventListener('storage'"))
  assert.ok(content.includes("console.log('socket connected:', socket.id)"))
  assert.ok(content.includes("console.log('socket disconnected:', reason)"))
})

test('generateApiFileContent with bonjour enables dynamic bonjour ip request interceptor', async () => {
  const { generateApiFileContent } = await import('../src/shared.js')

  // test bonjour dynamic api request interceptor
  const content = generateApiFileContent(['get', 'post'], { bonjour: true })
  assert.ok(content.includes("import { getApiBaseUrl } from './bonjour.js'"))
  assert.ok(content.includes('getApiBaseUrl()'))
  assert.ok(content.includes('API.interceptors.request.use'))
  assert.ok(content.includes('config.baseURL = dynamicUrl'))
})

test('installPackages is exported from get binary and callable', async () => {
  const { installPackages } = await import('../src/bin/get.js')
  assert.equal(typeof installPackages, 'function')
})

test('isSafeRemoteUrl accepts valid https, ssh, and custom domain git urls', async () => {
  const { isSafeRemoteUrl } = await import('../src/commands/git.js')

  assert.equal(isSafeRemoteUrl('https://github.com/user/repo.git'), true)
  assert.equal(isSafeRemoteUrl('https://git.4brains.in/himangshu.kamila/Tote-Bag-Printer.git'), true)
  assert.equal(isSafeRemoteUrl('git@github.com:user/repo.git'), true)
  assert.equal(isSafeRemoteUrl('ssh://git@git.4brains.in:22/user/repo.git'), true)

  assert.equal(isSafeRemoteUrl(''), false)
  assert.equal(isSafeRemoteUrl('not-a-url'), false)
  assert.equal(isSafeRemoteUrl('ext::sh -c evil'), false)
})

test('camera command and webcam setup generate a matching pair without changing app files', async () => {
  const { Command } = await import('commander')
  const { registerGeneratorCommands } = await import('../src/commands/cli/generatorCommands.js')
  const { configureWebcam, readTemplate } = await import('../src/shared.js')
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'zecron-camera-'))
  const originalCwd = process.cwd()
  const manifest = JSON.stringify({ dependencies: { 'react-webcam': '^7.2.0', clsx: '^2.1.1', 'react-error-boundary': '^6.0.0' } })
  try {
    await fs.mkdir(path.join(project, 'src'))
    await fs.writeFile(path.join(project, 'package.json'), manifest)
    await fs.writeFile(path.join(project, 'src/App.jsx'), 'export default function App() { return null }')
    process.chdir(project)
    for (const args of [['set', 'camera'], ['set', '--camera'], ['set', 'webcam']]) {
      const program = new Command()
      registerGeneratorCommands(program)
      await program.parseAsync(args, { from: 'user' })
    }
    await configureWebcam(project)
    for (const [folder, name] of [['pages', 'Camera.jsx'], ['components', 'Preview.jsx']]) {
      const generated = await fs.readFile(path.join(project, 'src', folder, name), 'utf8')
      assert.equal(generated.slice(generated.indexOf('\n') + 1), await readTemplate('camera', name))
    }
    assert.equal(await fs.readFile(path.join(project, 'package.json'), 'utf8'), manifest)
    assert.equal(await fs.readFile(path.join(project, 'src/App.jsx'), 'utf8'), 'export default function App() { return null }')
    assert.deepEqual((await fs.readdir(path.join(project, 'src'))).sort(), ['App.jsx', 'components', 'pages'])
  } finally {
    process.chdir(originalCwd)
    await fs.rm(project, { recursive: true, force: true })
  }
})

test('camera setup preserves a custom preview and does not generate an incompatible camera', async () => {
  const { configureCameraBoilerplate } = await import('../src/generators/camera.js')
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'zecron-camera-kept-'))
  const originalStdinIsTTY = process.stdin.isTTY
  const originalStdoutIsTTY = process.stdout.isTTY
  try {
    process.stdin.isTTY = false
    process.stdout.isTTY = false
    await fs.writeFile(path.join(project, 'package.json'), JSON.stringify({ dependencies: { 'react-webcam': '*', clsx: '*', 'react-error-boundary': '*' } }))
    await fs.mkdir(path.join(project, 'src/components'), { recursive: true })
    const preview = path.join(project, 'src/components/Preview.jsx')
    await fs.writeFile(preview, 'export default function CustomPreview() { return null }')
    await assert.rejects(configureCameraBoilerplate(project), /Camera setup stopped.*Preview.jsx was kept/)
    assert.equal(await fs.readFile(preview, 'utf8'), 'export default function CustomPreview() { return null }')
    await assert.rejects(fs.access(path.join(project, 'src/pages/Camera.jsx')))
  } finally {
    process.stdin.isTTY = originalStdinIsTTY
    process.stdout.isTTY = originalStdoutIsTTY
    await fs.rm(project, { recursive: true, force: true })
  }
})

test('camera capture crops native pixels and encodes once for every right-angle rotation', async () => {
  const ts = await import('typescript')
  const { cameraContent } = await import('../src/shared.js')
  const source = ts.createSourceFile('Camera.jsx', cameraContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX)
  const captureNode = source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'capturePhoto')
  assert.ok(captureNode)
  const video = { readyState: 4, videoWidth: 3840, videoHeight: 2160 }
  for (const rotation of [0, 90, 180, 270]) {
    const operations: any[][] = []
    const context = Object.fromEntries(['translate', 'rotate', 'scale', 'drawImage'].map((method) => [method, (...args: any[]) => operations.push([method, ...args])]))
    let encodes = 0
    let canvases = 0
    const canvas = {
      width: 0, height: 0,
      getContext: (kind: string) => { assert.equal(kind, '2d'); return context },
      toDataURL: (kind: string, quality: number) => {
        encodes++
        assert.equal(kind, 'image/jpeg')
        assert.equal(quality, 0.95)
        return 'data:image/jpeg;base64,test'
      },
    }
    const capture = runInNewContext(captureNode.getText(source) + '\ncapturePhoto', {
      document: { createElement: (tag: string) => { canvases++; assert.equal(tag, 'canvas'); return canvas } },
    })
    assert.equal(capture(video, { clientWidth: 800, clientHeight: 1000 }, rotation), 'data:image/jpeg;base64,test')
    assert.equal(canvases, 1)
    assert.equal(encodes, 1)
    const sideways = rotation === 90 || rotation === 270
    assert.deepEqual([canvas.width, canvas.height], sideways ? [2160, 2700] : [1728, 2160])
    assert.deepEqual(operations, [
      ['translate', canvas.width / 2, canvas.height / 2],
      ['rotate', rotation * Math.PI / 180],
      ['scale', -1, 1],
      sideways
        ? ['drawImage', video, 570, 0, 2700, 2160, -1350, -1080, 2700, 2160]
        : ['drawImage', video, 1056, 0, 1728, 2160, -864, -1080, 1728, 2160],
    ])
    assert.throws(() => capture(null, { clientWidth: 800, clientHeight: 1000 }, rotation), /not ready/)
    assert.equal(encodes, 1)
  }
})

test('camera switching stops the previous stream before replacing the webcam', async () => {
  const ts = await import('typescript')
  const { cameraContent } = await import('../src/shared.js')
  const source = ts.createSourceFile('Camera.jsx', cameraContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX)
  const flow = source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'CameraFlow')
  assert.ok(flow && ts.isFunctionDeclaration(flow))
  const declaration = flow.body?.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((variable) => variable.name.getText(source) === 'restartCamera')
  assert.ok(declaration?.initializer)
  let stopped = 0
  const streamRef = { current: { getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }] } }
  const requestRef = { current: { deviceId: 'laptop', relaxed: false, version: 1 } }
  const restart = runInNewContext('(' + declaration.initializer.getText(source) + ')', {
    streamRef, requestRef,
    setStream: () => {}, setIsReady: () => {}, setIsSelecting: () => {}, setError: () => {}, setCountdown: () => {},
    setRequest: () => {
      assert.equal(stopped, 2, 'tracks must stop even before react-webcam commits its media state')
      assert.equal(streamRef.current, null)
    },
  })
  restart('brio')
  assert.equal(requestRef.current.deviceId, 'brio')
  assert.equal(requestRef.current.version, 2)
  restart('brio', true)
  assert.equal(requestRef.current.version, 3)
  assert.equal(requestRef.current.relaxed, true)
  assert.equal(stopped, 2)
})

let deviceTestCode: string | undefined

const loadDeviceInfoForTest = async (globals: Record<string, any> = {}) => {
  if (!deviceTestCode) {
    const ts = await import('typescript')
    const { readTemplate } = await import('../src/shared.js')
    const compiled = ts.transpileModule(await readTemplate('device', 'deviceInfo.js'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      reportDiagnostics: true,
      fileName: 'deviceInfo.js',
    })
    assert.equal(compiled.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0)
    deviceTestCode = compiled.outputText
  }
  const exports: Record<string, any> = {}
  runInNewContext(deviceTestCode, {
    exports,
    setTimeout,
    clearTimeout,
    console: { log() {}, error() {} },
    ...globals,
  })
  return exports
}

const deviceWindowForTest = (navigator: Record<string, any> = {}, document: Record<string, any> = {}) => ({
  navigator: {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    language: 'en-US', languages: ['en-US'], maxTouchPoints: 0, onLine: true,
    ...navigator,
  },
  document: { visibilityState: 'visible', createElement: () => ({ getContext: () => null }), ...document },
  screen: { width: 1920, height: 1080, orientation: { type: 'landscape-primary', angle: 0 } },
  innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 800,
  devicePixelRatio: 1, isSecureContext: true,
  matchMedia: () => ({ matches: false }),
})

const deviceClockForTest = () => {
  let nextId = 0
  const pending = new Map<number, () => void>()
  const durations: number[] = []
  return {
    pending,
    durations,
    setTimeout(callback: () => void, milliseconds: number) {
      durations.push(milliseconds)
      pending.set(++nextId, callback)
      return nextId
    },
    clearTimeout(id: number) { pending.delete(id) },
    expire() {
      const callbacks = [...pending.values()]
      pending.clear()
      callbacks.forEach((callback) => callback())
    },
  }
}

const deferredDeviceProbe = () => {
  let resolve!: (value: any) => void
  let reject!: (error: Error) => void
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('device commands generate only the utility and are idempotent without package changes', async () => {
  const { Command } = await import('commander')
  const { registerGeneratorCommands } = await import('../src/commands/cli/generatorCommands.js')
  const { readTemplate } = await import('../src/shared.js')
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'zecron-device-'))
  const originalCwd = process.cwd()
  const files = {
    'package.json': '{"name":"device-test","private":true}',
    'package-lock.json': '{"name":"device-test","lockfileVersion":3}',
    'src/App.jsx': 'export default function App() { return null }',
  }
  try {
    await fs.mkdir(path.join(project, 'src'))
    for (const [name, content] of Object.entries(files)) await fs.writeFile(path.join(project, name), content)
    process.chdir(project)
    const run = async (args: string[]) => {
      const program = new Command()
      registerGeneratorCommands(program)
      await program.parseAsync(args, { from: 'user' })
    }
    await run(['set', 'device'])
    const utility = path.join(project, 'src/utils/deviceInfo.js')
    const generated = await fs.readFile(utility, 'utf8')
    assert.equal(generated.slice(generated.indexOf('\n') + 1), await readTemplate('device', 'deviceInfo.js'))
    await fs.utimes(utility, new Date(1000000), new Date(1000000))
    const before = (await fs.stat(utility)).mtimeMs
    await run(['set', '--device'])
    await run(['set', 'device'])
    assert.equal((await fs.stat(utility)).mtimeMs, before, 'unchanged generation must not rewrite the file')
    assert.equal(await fs.readFile(utility, 'utf8'), generated)
    for (const [name, content] of Object.entries(files)) assert.equal(await fs.readFile(path.join(project, name), 'utf8'), content)
    assert.deepEqual((await fs.readdir(project)).sort(), ['package-lock.json', 'package.json', 'src'])
    assert.deepEqual((await fs.readdir(path.join(project, 'src'))).sort(), ['App.jsx', 'utils'])
    assert.deepEqual(await fs.readdir(path.join(project, 'src/utils')), ['deviceInfo.js'])
  } finally {
    process.chdir(originalCwd)
    await fs.rm(project, { recursive: true, force: true })
  }
})

test('device generation preserves existing and hand-edited utilities without a TTY', async () => {
  const { configureDeviceInfo } = await import('../src/generators/device.js')
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'zecron-device-kept-'))
  const originalStdinIsTTY = process.stdin.isTTY
  const originalStdoutIsTTY = process.stdout.isTTY
  try {
    process.stdin.isTTY = false
    process.stdout.isTTY = false
    await configureDeviceInfo(project)
    const utility = path.join(project, 'src/utils/deviceInfo.js')
    const generated = await fs.readFile(utility, 'utf8')
    for (const custom of [generated + '\n// local customization\n', 'export default () => ({ custom: true })\n']) {
      await fs.writeFile(utility, custom)
      await configureDeviceInfo(project)
      assert.equal(await fs.readFile(utility, 'utf8'), custom)
    }
    assert.deepEqual(await fs.readdir(project), ['src'])
  } finally {
    process.stdin.isTTY = originalStdinIsTTY
    process.stdout.isTTY = originalStdoutIsTTY
    await fs.rm(project, { recursive: true, force: true })
  }
})

test('device utility has no import side effects and safely returns null outside a browser', async () => {
  const unexpected = () => { throw new Error('browser access or side effect during import') }
  const imported = await loadDeviceInfoForTest({
    window: new Proxy({}, { get: unexpected }),
    setTimeout: unexpected, clearTimeout: unexpected,
    console: { log: unexpected, error: unexpected },
  })
  assert.equal(imported.default, imported.getDeviceInfo)
  assert.equal(imported.handleGetBrowserDetails, imported.getDeviceInfo)
  for (const window of [undefined, {}, { navigator: {} }, { document: {} }]) {
    const api = await loadDeviceInfoForTest({ window, setTimeout: unexpected, console: { log: unexpected } })
    assert.equal(await api.getDeviceInfo(), null)
  }
})

test('device detection covers phone, tablet and laptop browser profiles', async (t) => {
  const apple = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
  const ipad = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
  const android = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko)'
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
  const chrome = 'Chrome/120.0.0.0'
  const cases = [
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', touch: 5, browser: 'Safari', version: '17.0', os: 'iPadOS', device: 'tablet' },
    { ua: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', touch: 5, browser: 'Chrome', version: '120.0.0.0', os: 'Android', device: 'tablet' },
    { ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36', touch: 5, browser: 'Chrome', version: '120.0.0.0', os: 'Android', device: 'mobile' },
    { ua: apple + ' CriOS/120.0.6099.101 Mobile/15E148 Safari/604.1', touch: 5, browser: 'Chrome', version: '120.0.6099.101', os: 'iOS', device: 'mobile' },
    { ua: apple + ' FxiOS/121.0 Mobile/15E148 Safari/605.1.15', touch: 5, browser: 'Firefox', version: '121.0', os: 'iOS', device: 'mobile' },
    { ua: apple + ' EdgiOS/120.0.2210.61 Mobile/15E148 Safari/605.1.15', touch: 5, browser: 'Edge', version: '120.0.2210.61', os: 'iOS', device: 'mobile' },
    { ua: apple + ' OPiOS/4.2.0 Mobile/15E148 Safari/9537.53', touch: 5, browser: 'Opera', version: '4.2.0', os: 'iOS', device: 'mobile' },
    { ua: apple + ' Version/17.0 Mobile/15E148 Safari/604.1', touch: 5, browser: 'Safari', version: '17.0', os: 'iOS', device: 'mobile' },
    { ua: apple + ' Version/17.0 Mobile/15E148 Safari/604.1 OPT/4.0.0', touch: 5, browser: 'Opera', version: '4.0.0', os: 'iOS', device: 'mobile' },
    { ua: apple + ' OPT/4.0.0 Mobile/15E148', touch: 5, browser: 'Opera', version: '4.0.0', os: 'iOS', device: 'mobile' },
    { ua: ipad + ' Version/17.0 Mobile/15E148 Safari/604.1', touch: 5, browser: 'Safari', version: '17.0', os: 'iPadOS', device: 'tablet' },
    { ua: ipad + ' CriOS/120.0.6099.101 Mobile/15E148 Safari/604.1', touch: 5, browser: 'Chrome', version: '120.0.6099.101', os: 'iPadOS', device: 'tablet' },
    { ua: ipad + ' FxiOS/121.0 Mobile/15E148 Safari/605.1.15', touch: 5, browser: 'Firefox', version: '121.0', os: 'iPadOS', device: 'tablet' },
    { ua: ipad + ' EdgiOS/120.0.2210.61 Mobile/15E148 Safari/605.1.15', touch: 5, browser: 'Edge', version: '120.0.2210.61', os: 'iPadOS', device: 'tablet' },
    { ua: mac + ' CriOS/120 Version/11.1.1 Safari/605.1.15', touch: 5, browser: 'Chrome', version: '120', os: 'iPadOS', device: 'tablet' },
    { ua: `${android} ${chrome} Mobile Safari/537.36`, touch: 5, browser: 'Chrome', version: '120.0.0.0', os: 'Android', device: 'mobile' },
    { ua: `${android} ${chrome} Safari/537.36`, touch: 5, browser: 'Chrome', version: '120.0.0.0', os: 'Android', device: 'tablet' },
    { ua: `${android} SamsungBrowser/23.0 ${chrome} Mobile Safari/537.36`, touch: 5, browser: 'Samsung Internet', version: '23.0', os: 'Android', device: 'mobile' },
    { ua: `${android} SamsungBrowser/23.0 ${chrome} Safari/537.36`, touch: 5, browser: 'Samsung Internet', version: '23.0', os: 'Android', device: 'tablet' },
    { ua: `${android} ${chrome} Mobile Safari/537.36 EdgA/120.0.2210.64`, touch: 5, browser: 'Edge', version: '120.0.2210.64', os: 'Android', device: 'mobile' },
    { ua: `${android} ${chrome} Mobile Safari/537.36 OPR/80.0.4244.77596`, touch: 5, browser: 'Opera', version: '80.0.4244.77596', os: 'Android', device: 'mobile' },
    { ua: 'Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0', touch: 5, browser: 'Firefox', version: '121.0', os: 'Android', device: 'mobile' },
    { ua: 'Mozilla/5.0 (Android 13; Tablet; rv:121.0) Gecko/121.0 Firefox/121.0', touch: 5, browser: 'Firefox', version: '121.0', os: 'Android', device: 'tablet' },
    { ua: `${windows} ${chrome} Safari/537.36`, touch: 0, browser: 'Chrome', version: '120.0.0.0', os: 'Windows', device: 'desktop' },
    { ua: `${windows} ${chrome} Safari/537.36 Edg/120.0.2210.61`, touch: 10, browser: 'Edge', version: '120.0.2210.61', os: 'Windows', device: 'desktop' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', touch: 0, browser: 'Firefox', version: '121.0', os: 'Windows', device: 'desktop' },
    { ua: `${windows} ${chrome} Safari/537.36 OPR/106.0.0.0`, touch: 0, browser: 'Opera', version: '106.0.0.0', os: 'Windows', device: 'desktop' },
    { ua: mac + ' Version/17.0 Safari/605.1.15', touch: 0, browser: 'Safari', version: '17.0', os: 'macOS', device: 'desktop' },
    { ua: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ${chrome} Safari/537.36`, touch: 0, browser: 'Chrome', version: '120.0.0.0', os: 'macOS', device: 'desktop' },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0', touch: 0, browser: 'Firefox', version: '121.0', os: 'macOS', device: 'desktop' },
    { ua: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chromium/120.0.0.0 ${chrome} Safari/537.36`, touch: 0, browser: 'Chromium', version: '120.0.0.0', os: 'Linux', device: 'desktop' },
    { ua: `Mozilla/5.0 (X11; CrOS x86_64 15662.0.0) AppleWebKit/537.36 ${chrome} Safari/537.36`, touch: 10, browser: 'Chrome', version: '120.0.0.0', os: 'ChromeOS', device: 'desktop' },
    { ua: '', touch: 0, browser: 'Unknown', version: null, os: 'Unknown', device: 'unknown' },
  ]
  for (const item of cases) {
    await t.test(`${item.os} ${item.device}: ${item.ua || 'unavailable user agent'}`, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({ userAgent: item.ua, maxTouchPoints: item.touch }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, item.browser)
      assert.equal(details.browser.version, item.version)
      assert.equal(details.os, item.os)
      assert.equal(details.deviceType, item.device)
    })
  }
})

test('device detection uses client hints without confusing tablets and touchscreen laptops', async (t) => {
  const brands = [{ brand: 'Not_A Brand', version: '99' }, { brand: 'Chromium', version: '120' }, { brand: 'Google Chrome', version: '120' }]
  const android = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120.0.0.0'
  const linux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  const cases = [
    { name: 'reduced Android phone', ua: android + ' Mobile Safari/537.36', platform: 'Android', mobile: true, factors: ['Mobile'], os: 'Android', device: 'mobile' },
    { name: 'reduced Android tablet', ua: android + ' Safari/537.36', platform: 'Android', mobile: false, factors: ['Tablet'], os: 'Android', device: 'tablet' },
    { name: 'Android tablet without form factors', ua: android + ' Safari/537.36', platform: 'Android', mobile: false, factors: [], os: 'Android', device: 'tablet' },
    { name: 'Windows touchscreen laptop', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Windows', mobile: false, factors: ['Desktop'], os: 'Windows', device: 'desktop' },
    { name: 'desktop UA with explicit tablet hint', ua: linux, platform: 'Android', mobile: false, factors: ['Tablet'], os: 'Android', device: 'tablet' },
    // desktop mode can hide both the android os and tablet form factor.
    { name: 'desktop-masked Android tablet reports only Linux desktop', ua: linux, platform: 'Linux', mobile: false, factors: [], os: 'Linux', device: 'desktop' },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: item.ua, maxTouchPoints: 10,
        userAgentData: {
          brands, mobile: item.mobile, platform: item.platform,
          getHighEntropyValues: async () => ({
            formFactors: item.factors,
            fullVersionList: [{ brand: 'Google Chrome', version: '120.0.6099.109' }, { brand: 'Not_A Brand', version: '99.0.0.0' }, { brand: 'Chromium', version: '120.0.6099.109' }],
          }),
        },
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, 'Chrome')
      assert.equal(details.browser.version, '120.0.6099.109')
      assert.equal(details.os, item.os)
      assert.equal(details.deviceType, item.device)
    })
  }
})

test('device detection retains low entropy hints when detailed hints are denied or fail', async (t) => {
  for (const mode of ['denied', 'rejected', 'unavailable']) {
    await t.test(mode, async () => {
      const lowEntropy = {
        brands: [{ brand: 'Not_A Brand', version: '99' }, { brand: 'Chromium', version: '120' }, { brand: 'Microsoft Edge', version: '120' }],
        mobile: true, platform: 'Android',
      }
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
        userAgentData: {
          ...lowEntropy,
          ...(mode === 'unavailable' ? {} : { getHighEntropyValues: async () => {
            if (mode === 'rejected') throw new Error('hints blocked')
            return lowEntropy
          } }),
        },
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, 'Edge')
      assert.equal(details.browser.version, '120')
      assert.equal(details.os, 'Android')
      assert.equal(details.deviceType, 'mobile')
      assert.equal(details.errors['hints.highEntropy'], mode === 'rejected' ? 'hints blocked' : undefined)
    })
  }
})

test('device diagnostics collect only the requested snapshot without hardware probes or transmission', async () => {
  const logs: any[][] = []
  const clock = deviceClockForTest()
  let unwantedCalls = 0
  const forbidden = () => { unwantedCalls++; throw new Error('unrequested operation') }
  const window = deviceWindowForTest({
    userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    userAgentData: {
      brands: [{ brand: 'Google Chrome', version: '120' }], mobile: true, platform: 'Android',
      getHighEntropyValues: async (fields: string[]) => {
        assert.ok(!fields.some((field) => ['architecture', 'bitness', 'wow64'].includes(field)))
        return { platformVersion: '14.0.0', model: 'Pixel 7', fullVersionList: [{ brand: 'Google Chrome', version: '120.0.6099.109' }] }
      },
    },
    connection: { saveData: false },
    getBattery: forbidden,
    mediaDevices: { enumerateDevices: forbidden, getUserMedia: forbidden },
    gpu: { requestAdapter: forbidden }, permissions: { query: forbidden },
    geolocation: { getCurrentPosition: forbidden }, sendBeacon: forbidden,
  }, { createElement: forbidden })
  window.screen.width = 0
  window.screen.height = Infinity
  window.innerWidth = 0
  window.innerHeight = Infinity
  window.matchMedia = (query: string) => ({ matches: query === '(prefers-color-scheme: light)' })
  const api = await loadDeviceInfoForTest({
    window: { ...window, fetch: forbidden, XMLHttpRequest: forbidden },
    fetch: forbidden, XMLHttpRequest: forbidden, ...clock,
    console: { log: (...args: any[]) => logs.push(args) },
  })
  const details = await api.getDeviceInfo()
  assert.deepEqual(Object.keys(details).sort(), [
    'browser', 'deviceType', 'errors', 'manufacturer', 'model', 'modelSource', 'os', 'osVersion',
    'osVersionSource', 'preferences', 'screen', 'secureContext', 'viewport',
  ].sort())
  assert.equal(details.browser.name, 'Chrome')
  assert.equal(details.browser.version, '120.0.6099.109')
  assert.equal(details.browser.versionSource, 'client-hints')
  assert.equal(details.os, 'Android')
  assert.equal(details.osVersion, '14.0.0')
  assert.equal(details.osVersionSource, 'client-hints')
  assert.equal(details.model, 'Pixel 7')
  assert.equal(details.manufacturer, 'Google')
  assert.equal(details.modelSource, 'client-hints')
  assert.equal(details.screen.width, 0)
  assert.equal(details.screen.height, null)
  assert.equal(details.viewport.innerWidth, 0)
  assert.equal(details.viewport.innerHeight, null)
  assert.equal(details.preferences.darkMode, false)
  assert.equal(details.preferences.dataSaver, false)
  assert.equal(details.secureContext, true)
  assert.equal(Object.keys(details.errors).length, 0)
  assert.equal(clock.pending.size, 0)
  assert.equal(unwantedCalls, 0)
  assert.doesNotThrow(() => JSON.stringify(details))
  const logged = JSON.stringify(logs)
  assert.ok(!logged.includes(window.navigator.userAgent))
  assert.doesNotMatch(logged, /Pixel 7|120\.0\.6099\.109|14\.0\.0/)
})

test('device preferences distinguish enabled, disabled and unavailable settings', async (t) => {
  const cases = [
    { name: 'dark mode', matches: ['(prefers-color-scheme: dark)'], dark: true, data: null },
    { name: 'light mode', matches: ['(prefers-color-scheme: light)'], dark: false, data: null },
    { name: 'unsupported media preferences', matches: [], dark: null, data: null },
    { name: 'network data saver on', matches: [], saveData: true, dark: null, data: true },
    { name: 'network data saver off', matches: [], saveData: false, dark: null, data: false },
    { name: 'css reduced data', matches: ['(prefers-reduced-data: reduce)'], dark: null, data: true },
    { name: 'css normal data', matches: ['(prefers-reduced-data: no-preference)'], dark: null, data: false },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const window = deviceWindowForTest({ connection: item.saveData === undefined ? undefined : { saveData: item.saveData } })
      window.matchMedia = (query: string) => ({ matches: item.matches.includes(query) })
      const api = await loadDeviceInfoForTest({ window })
      const details = await api.getDeviceInfo()
      assert.equal(details.preferences.darkMode, item.dark)
      assert.equal(details.preferences.dataSaver, item.data)
    })
  }
  const api = await loadDeviceInfoForTest({ window: { ...deviceWindowForTest(), matchMedia: undefined } })
  const details = await api.getDeviceInfo()
  assert.equal(details.preferences.darkMode, null)
  assert.equal(details.preferences.dataSaver, null)
})

test('device dimensions and preferences remain fresh without rewriting browser-reported orientation', async () => {
  let dark = false
  const window = deviceWindowForTest({ connection: { saveData: false } })
  window.screen.width = 390
  window.screen.height = 844
  window.innerWidth = 390
  window.innerHeight = 844
  window.devicePixelRatio = 3
  window.matchMedia = (query: string) => ({ matches: query === `(prefers-color-scheme: ${dark ? 'dark' : 'light'})` })
  const api = await loadDeviceInfoForTest({ window })
  const first = await api.getDeviceInfo()
  const before = JSON.stringify(first)
  window.innerWidth = 844
  window.innerHeight = 390
  window.devicePixelRatio = 2
  window.navigator.connection.saveData = true
  dark = true
  const second = await api.getDeviceInfo()
  assert.equal(second.screen.width, 390)
  assert.equal(second.screen.height, 844)
  assert.equal(second.screen.devicePixelRatio, 2)
  assert.equal(second.viewport.innerWidth, 844)
  assert.equal(second.viewport.innerHeight, 390)
  assert.equal(second.preferences.darkMode, true)
  assert.equal(second.preferences.dataSaver, true)
  assert.equal(first.preferences.darkMode, false)
  assert.equal(first.preferences.dataSaver, false)
  assert.equal(JSON.stringify(first), before, 'later reads must not mutate an earlier snapshot')
})

test('device timeout validates its range, uses the default, and cleans settled timers', async () => {
  const clock = deviceClockForTest()
  const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
    userAgentData: { brands: [], mobile: false, platform: 'Linux', getHighEntropyValues: async () => ({}) },
  }), ...clock })
  for (const timeoutMs of [0, -1, NaN, Infinity, -Infinity, 2147483648, '250']) {
    await assert.rejects(api.getDeviceInfo({ timeoutMs }), /timeoutMs/)
  }
  assert.equal(clock.durations.length, 0)
  await api.getDeviceInfo()
  await api.getDeviceInfo({ timeoutMs: 2147483647 })
  assert.deepEqual(clock.durations, [2000, 2147483647])
  assert.equal(clock.pending.size, 0)
})

test('device hint timeouts retain base details and consume late outcomes without mutation', async (t) => {
  for (const outcome of ['resolve', 'reject']) {
    await t.test(outcome, async () => {
      const clock = deviceClockForTest()
      const probe = deferredDeviceProbe()
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgentData: {
          brands: [{ brand: 'Google Chrome', version: '120' }], mobile: false, platform: 'Linux',
          getHighEntropyValues: () => probe.promise,
        },
      }), ...clock })
      const pending = api.getDeviceInfo({ timeoutMs: 25 })
      await delay(0)
      assert.equal(clock.pending.size, 1)
      assert.deepEqual(clock.durations, [25])
      clock.expire()
      const details = await pending
      assert.equal(details.browser.name, 'Chrome')
      assert.equal(details.os, 'Linux')
      assert.equal(details.screen.width, 1920)
      assert.deepEqual(Object.keys(details.errors), ['hints.highEntropy'])
      assert.match(details.errors['hints.highEntropy'], /timed out/i)
      assert.equal(clock.pending.size, 0)
      const snapshot = JSON.stringify(details)
      if (outcome === 'resolve') probe.resolve({ platform: 'Android', platformVersion: '14.0.0', formFactors: ['Mobile'], model: 'Pixel 7' })
      else probe.reject(new Error('late hint rejection'))
      await delay(0)
      assert.equal(JSON.stringify(details), snapshot)
      assert.equal(clock.pending.size, 0)
    })
  }
})

test('device detection works when Object.hasOwn is unavailable', async () => {
  const legacyObject = Object.create(Object)
  Object.defineProperty(legacyObject, 'hasOwn', { value: undefined })
  const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
    userAgentData: { brands: [], platform: 'Android', mobile: true },
  }), Object: legacyObject })
  const details = await api.getDeviceInfo()
  assert.equal(details.os, 'Android')
  assert.equal(details.deviceType, 'mobile')
  assert.equal(details.browser.name, 'Chrome')
})

test('device malformed hints and throwing optional getters do not discard the snapshot', async (t) => {
  for (const brands of [{ invalid: true }, [null, {}, { brand: 'Google Chrome', version: '120' }]]) {
    await t.test(`malformed brands ${JSON.stringify(brands)}`, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgentData: { brands, platform: 'Android', mobile: true, getHighEntropyValues: async () => ({ fullVersionList: {}, formFactors: {} }) },
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, 'Chrome')
      assert.equal(details.os, 'Android')
      assert.equal(details.screen.width, 1920)
      assert.doesNotThrow(() => JSON.stringify(details))
    })
  }
  for (const field of ['userAgentData', 'screen.width', 'matchMedia']) {
    await t.test(`blocked ${field}`, async () => {
      const window = deviceWindowForTest()
      const blocked = () => { throw new Error('optional read blocked') }
      if (field === 'userAgentData') Object.defineProperty(window.navigator, 'userAgentData', { get: blocked })
      if (field === 'screen.width') Object.defineProperty(window.screen, 'width', { get: blocked })
      if (field === 'matchMedia') window.matchMedia = blocked
      const api = await loadDeviceInfoForTest({ window })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, 'Chrome')
      assert.equal(details.os, 'Linux')
      assert.equal(details.viewport.innerWidth, 1280)
      assert.ok(Object.keys(details.errors).length > 0)
      if (field === 'matchMedia') {
        assert.equal(details.preferences.darkMode, null)
        assert.equal(details.preferences.dataSaver, null)
      }
    })
  }
})

test('device OS versions and models use exposed values without guessing hidden details', async (t) => {
  const android = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  const cases = [
    { name: 'Android hints expose Pixel model and current version', ua: android, platform: 'Android', hints: { platformVersion: '14.0.0', model: 'Pixel 7' }, os: 'Android', version: '14.0.0', source: 'client-hints', manufacturer: 'Google', model: 'Pixel 7', modelSource: 'client-hints' },
    { name: 'Android hints expose Samsung tablet model', ua: android, platform: 'Android', hints: { platformVersion: '13.0.0', model: 'SM-X710', formFactors: ['Tablet'] }, os: 'Android', version: '13.0.0', source: 'client-hints', manufacturer: 'Samsung', model: 'SM-X710', modelSource: 'client-hints' },
    { name: 'macOS hints override the frozen UA version', ua: mac, platform: 'macOS', hints: { platformVersion: '15.4.0', model: '' }, os: 'macOS', version: '15.4.0', source: 'client-hints', manufacturer: 'Apple', model: null, modelSource: null },
    { name: 'Windows newer platform hint', ua: windows, platform: 'Windows', hints: { platformVersion: '13.0.0' }, os: 'Windows', version: '11 or later', source: 'client-hints', manufacturer: null, model: null, modelSource: null },
    { name: 'Windows 10 platform hint', ua: windows, platform: 'Windows', hints: { platformVersion: '10.0.0' }, os: 'Windows', version: '10', source: 'client-hints', manufacturer: null, model: null, modelSource: null },
    { name: 'Windows NT 10 cannot distinguish 10 from 11', ua: windows, os: 'Windows', version: null, source: null, manufacturer: null, model: null, modelSource: null },
    { name: 'reduced Android UA has no exact model or OS version', ua: android, os: 'Android', version: null, source: null, manufacturer: null, model: null, modelSource: null },
    { name: 'legacy Pixel UA exposes model and OS version', ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36', os: 'Android', version: '13', source: 'user-agent', manufacturer: 'Google', model: 'Pixel 7', modelSource: 'user-agent' },
    { name: 'legacy Samsung UA exposes tablet model', ua: 'Mozilla/5.0 (Linux; Android 13; SM-X710 Build/TP1A.220624.014) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', os: 'Android', version: '13', source: 'user-agent', manufacturer: 'Samsung', model: 'SM-X710', modelSource: 'user-agent' },
    { name: 'Android Firefox engine token is not a model', ua: 'Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0', os: 'Android', version: '13', source: 'user-agent', manufacturer: null, model: null, modelSource: null },
    { name: 'Firefox Android frozen OS token remains unknown', ua: 'Mozilla/5.0 (Android 10; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0', os: 'Android', version: null, source: null, manufacturer: null, model: null, modelSource: null },
    { name: 'older Firefox Android can report Android 10', ua: 'Mozilla/5.0 (Android 10; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0', os: 'Android', version: '10', source: 'user-agent', manufacturer: null, model: null, modelSource: null },
    { name: 'Firefox iOS frozen OS token remains unknown', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 FxiOS/149.1 Mobile/15E148 Safari/605.1.15', os: 'iOS', version: null, source: null, manufacturer: 'Apple', model: null, modelSource: null },
    { name: 'iPhone exposes family but not exact hardware model', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1', os: 'iOS', version: '17.4', source: 'user-agent', manufacturer: 'Apple', model: null, modelSource: null },
    { name: 'Safari 26 frozen iOS version remains unknown', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1', os: 'iOS', version: null, source: null, manufacturer: 'Apple', model: null, modelSource: null },
    { name: 'desktop-mode iPad does not use the macOS UA version', ua: mac, touch: 5, os: 'iPadOS', version: null, source: null, manufacturer: 'Apple', model: null, modelSource: null },
    { name: 'unrecognized exposed Android model does not invent a maker', ua: android, platform: 'Android', hints: { platformVersion: '14.0.0', model: 'unrecognized-device' }, os: 'Android', version: '14.0.0', source: 'client-hints', manufacturer: null, model: 'unrecognized-device', modelSource: 'client-hints' },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: item.ua, maxTouchPoints: item.touch || 0,
        ...(item.hints ? { userAgentData: { brands: [], mobile: false, platform: item.platform, getHighEntropyValues: async () => item.hints } } : {}),
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.os, item.os)
      assert.equal(details.osVersion, item.version)
      assert.equal(details.osVersionSource, item.source)
      assert.equal(details.manufacturer, item.manufacturer)
      assert.equal(details.model, item.model)
      assert.equal(details.modelSource, item.modelSource)
    })
  }
})

test('device detection avoids reporting engine versions as Brave or WebView app versions', async (t) => {
  const android = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
  const cases = [
    { name: 'Brave token', ua: android + ' Brave', expected: 'Brave' },
    { name: 'Brave client hint', ua: android, brands: [{ brand: 'Chromium', version: '120' }, { brand: 'Brave', version: '120' }], expected: 'Brave' },
    { name: 'Android WebView', ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36', expected: 'Android WebView' },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: item.ua,
        ...(item.brands ? { userAgentData: { brands: item.brands, mobile: true, platform: 'Android' } } : {}),
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, item.expected)
      assert.equal(details.browser.version, null)
      assert.equal(details.browser.versionSource, null)
      assert.equal(details.os, 'Android')
      assert.equal(details.deviceType, 'mobile')
    })
  }
})

test('device explicit browser and app markers take precedence over embedded Chrome and Safari', async (t) => {
  const android = 'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36'
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1'
  const chrome = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
  const cases = [
    { name: 'Instagram', ua: android + ' Instagram 319.0.0.43.110 Android', version: '319.0.0.43.110' },
    { name: 'Facebook', ua: android + ' [FBAN/FB4A;FBAV/450.0.0.0.1;]', version: '450.0.0.0.1' },
    { name: 'Google App', ua: iphone + ' GSA/308.0.617575852', version: '308.0.617575852' },
    { name: 'LinkedIn', ua: iphone + ' LinkedInApp', version: null },
    { name: 'Snapchat', ua: iphone + ' Snapchat/12.70.0.24', version: '12.70.0.24' },
    { name: 'Yandex', ua: chrome + ' YaBrowser/23.11.6.60', version: '23.11.6.60' },
    { name: 'DuckDuckGo', ua: iphone + ' Ddg/7.108.0', version: '7.108.0' },
    { name: 'UC Browser', ua: chrome + ' UCBrowser/13.4.0.1306', version: '13.4.0.1306' },
    { name: 'MIUI Browser', ua: chrome + ' MiuiBrowser/17.9.160229', version: '17.9.160229' },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: item.ua,
        ...(item.ua.includes('Android') ? { userAgentData: { brands: [{ brand: 'Google Chrome', version: '120' }], mobile: true, platform: 'Android' } } : {}),
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, item.name)
      assert.equal(details.browser.version, item.version)
      assert.equal(details.browser.versionSource, item.version ? 'user-agent' : null)
      assert.equal(details.deviceType, 'mobile')
    })
  }
})

test('device diagnostics are silent by default and debug logs exclude diagnostic values', async () => {
  for (const debug of [undefined, false, 'true', true]) {
    for (const failed of [false, true]) {
      const logs: any[][] = []
      const api = await loadDeviceInfoForTest({
        window: deviceWindowForTest({
          userAgent: 'Mozilla/5.0 (Linux; Android 14; private-model) Chrome/120.0.0.0 Mobile Safari/537.36',
          userAgentData: {
            brands: [], mobile: true, platform: 'Android',
            getHighEntropyValues: async () => {
              if (failed) throw new Error('private-probe-error')
              return { model: 'private-model', platformVersion: '14.0.0' }
            },
          },
        }),
        console: { log: (...args: any[]) => logs.push(args) },
      })
      const details = await api.getDeviceInfo({ debug })
      assert.equal(details.deviceType, 'mobile')
      if (debug === true) {
        assert.ok(logs.length > 0)
        assert.match(JSON.stringify(logs), /collection started/)
        assert.match(JSON.stringify(logs), /collection completed/)
      } else {
        assert.deepEqual(logs, [])
      }
      assert.doesNotMatch(JSON.stringify(logs), /private-|Mozilla|14\.0\.0|120\.0\.0\.0/)
    }
  }
})

test('device hint failures retain distinct field paths', async () => {
  const detailed = Object.defineProperties({}, {
    platform: { get() { throw new Error('detailed platform blocked') } },
    model: { get() { throw new Error('detailed model blocked') } },
  })
  const hints = Object.defineProperties({ getHighEntropyValues: async () => detailed }, {
    platform: { get() { throw new Error('basic platform blocked') } },
    brands: { get() { throw new Error('basic brands blocked') } },
  })
  const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({ userAgentData: hints }) })
  const details = await api.getDeviceInfo()
  assert.equal(details.errors['hints.platform'], 'basic platform blocked')
  assert.equal(details.errors['hints.highEntropy.platform'], 'detailed platform blocked')
  assert.equal(details.errors['hints.model'], 'detailed model blocked')
  assert.equal(details.errors['hints.brands'], 'basic brands blocked')
  assert.equal(details.browser.name, 'Chrome')
  assert.equal(details.os, 'Linux')
  assert.equal(details.model, null)
  assert.equal(details.errors.model, undefined)
})

test('device ambiguous iOS tokens stay unknown without discarding distinct exposed versions', async (t) => {
  const cases = [
    { name: 'Chrome with ambiguous 18.6', osToken: '18_6', browser: 'CriOS/149.0.7827.72', version: null },
    { name: 'Edge with ambiguous 18.7', osToken: '18_7', browser: 'EdgiOS/149.0.3912.51', version: null },
    { name: 'in-app browser with ambiguous 18.7', osToken: '18_7', browser: 'Instagram 400.0.0.0.1', version: null },
    { name: 'Chrome exposing actual 26.0 token', osToken: '26_0', browser: 'CriOS/149.0.7827.72', version: '26.0' },
    { name: 'Safari exposing explicit 18.6 version', osToken: '18_6', browser: 'Version/18.6', version: '18.6' },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS ${item.osToken} like Mac OS X) AppleWebKit/605.1.15 ${item.browser} Mobile/15E148 Safari/604.1`,
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.os, 'iOS')
      assert.equal(details.osVersion, item.version)
      assert.equal(details.osVersionSource, item.version ? 'user-agent' : null)
    })
  }
})

test('device WebView fallbacks preserve named browsers and require recognizable embedded-browser signals', async (t) => {
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36'
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
  const cases = [
    { name: 'named Android browser with wv marker', ua: android + ' UCBrowser/13.4.0.1306', browser: 'UC Browser', version: '13.4.0.1306' },
    { name: 'generic Chrome hint does not hide WebView', ua: android, brands: [{ brand: 'Google Chrome', version: '120' }], browser: 'Android WebView', version: null },
    { name: 'unmarked iPhone webview', ua: ios, browser: 'iOS WebView', version: null },
    { name: 'unmarked iPad webview', ua: ios.replace('iPhone; CPU iPhone OS', 'iPad; CPU OS'), browser: 'iOS WebView', version: null },
    { name: 'named iOS Chrome keeps its identity', ua: ios + ' CriOS/120.0.6099.101', browser: 'Chrome', version: '120.0.6099.101' },
    { name: 'named iOS Firefox keeps its identity', ua: ios + ' FxiOS/121.0', browser: 'Firefox', version: '121.0' },
    { name: 'iPhone token alone is insufficient', ua: 'Example/1.0 (iPhone)', browser: 'Unknown', version: null },
    { name: 'AppleWebKit without mobile marker is insufficient', ua: ios.replace(' Mobile/15E148', ''), browser: 'Unknown', version: null },
    { name: 'Safari marker is not an unmarked webview', ua: ios + ' Safari/604.1', browser: 'Unknown', version: null },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: item.ua,
        ...(item.brands ? { userAgentData: { brands: item.brands, platform: 'Android', mobile: true } } : {}),
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, item.browser)
      assert.equal(details.browser.version, item.version)
    })
  }
})

test('device Yandex client-hint aliases preserve detailed version precedence', async (t) => {
  for (const detailedBrand of ['YaBrowser', 'Yandex Browser', 'Yandex']) {
    await t.test(detailedBrand, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 YaBrowser/23.11.0.0',
        userAgentData: {
          brands: [{ brand: 'YaBrowser', version: '23' }], mobile: true, platform: 'Android',
          getHighEntropyValues: async () => ({ fullVersionList: [{ brand: detailedBrand, version: '23.11.6.60' }] }),
        },
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, 'Yandex')
      assert.equal(details.browser.version, '23.11.6.60')
      assert.equal(details.browser.versionSource, 'client-hints')
    })
  }
})

test('device common TV box markers do not fall through to Android tablets', async (t) => {
  for (const marker of ['MIBOX4', 'GoogleTV', 'Chromecast', 'AndroidTV']) {
    await t.test(marker, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: `Mozilla/5.0 (Linux; Android 12; ${marker}) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36`,
      }) })
      assert.equal((await api.getDeviceInfo()).deviceType, 'tv')
    })
  }
})

test('device manufacturer code families avoid known collisions and preserve explicit brands', async (t) => {
  const cases = [
    { model: 'RMX3686', maker: 'realme', legacy: true },
    { model: 'CPH2573', maker: 'OPPO / OnePlus' },
    { model: 'OPPO CPH2573', maker: 'OPPO' },
    { model: 'OnePlus CPH2573', maker: 'OnePlus' },
    { model: 'V2239', maker: 'vivo', legacy: true },
    { model: 'I2202', maker: 'vivo' },
    { model: 'TECNO CK7n', maker: 'TECNO' },
    { model: 'Infinix X6833B', maker: 'Infinix', legacy: true },
    { model: 'itel S665L', maker: 'itel' },
    { model: 'M2007J20CG', maker: 'Xiaomi' },
    { model: '23090RA98G', maker: 'Xiaomi', legacy: true },
    { model: 'M1867G', maker: null },
    { model: 'M7042F', maker: null },
    { model: 'M7133E', maker: null },
    { model: '2306004M', maker: null },
    { model: '2305003M', maker: null },
    { model: '220333QAG', maker: null },
    { model: 'Redmi 220333QAG', maker: 'Xiaomi' },
    { model: 'CPH2573A', maker: null },
  ]
  for (const item of cases) {
    await t.test(item.model, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: `Mozilla/5.0 (Linux; Android 14; ${item.legacy ? item.model : 'K'}) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36`,
        ...(item.legacy ? {} : { userAgentData: {
          brands: [], mobile: true, platform: 'Android',
          getHighEntropyValues: async () => ({ model: item.model }),
        } }),
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.manufacturer, item.maker)
      assert.equal(details.model, item.model)
      assert.equal(details.modelSource, item.legacy ? 'user-agent' : 'client-hints')
    })
  }
})

test('device report Android tablet identity stays stable when desktop form factors arrive', async (t) => {
  const tabletUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
  for (const mode of ['success', 'denied', 'rejected', 'timeout']) {
    await t.test(mode, async () => {
      const clock = deviceClockForTest()
      const probe = deferredDeviceProbe()
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: tabletUA,
        userAgentData: {
          brands: [{ brand: 'Google Chrome', version: '141' }], platform: 'Android', mobile: false,
          getHighEntropyValues: async () => {
            if (mode === 'timeout') return probe.promise
            if (mode === 'rejected') throw new Error('hints blocked')
            return mode === 'success' ? { formFactors: ['Desktop'] } : {}
          },
        },
      }), ...clock })
      const pending = api.getDeviceInfo({ timeoutMs: 25 })
      if (mode === 'timeout') {
        await delay(0)
        clock.expire()
      }
      const details = await pending
      assert.equal(details.deviceType, 'tablet')
      assert.equal(details.os, 'Android')
      assert.equal(clock.pending.size, 0)
      probe.resolve({ formFactors: ['Desktop'] })
    })
  }
  const cases = [
    { name: 'phone', ua: tabletUA.replace(' Safari/', ' Mobile Safari/'), platform: 'Android', factors: ['Mobile'], mobile: true, device: 'mobile' },
    { name: 'Windows touchscreen laptop', ua: tabletUA.replace('Linux; Android 10; K', 'Windows NT 10.0; Win64; x64'), platform: 'Windows', factors: ['Desktop'], mobile: false, device: 'desktop' },
    { name: 'XR has priority', ua: tabletUA, platform: 'Android', factors: ['Desktop', 'XR'], mobile: false, device: 'xr' },
    { name: 'desktop site hides Android identity', ua: tabletUA.replace('Linux; Android 10; K', 'X11; Linux x86_64'), platform: 'Linux', factors: ['Desktop'], mobile: false, device: 'desktop' },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: item.ua, maxTouchPoints: 10,
        userAgentData: { brands: [], platform: item.platform, mobile: item.mobile, getHighEntropyValues: async () => ({ formFactors: item.factors }) },
      }) })
      assert.equal((await api.getDeviceInfo()).deviceType, item.device)
    })
  }
})

test('device report model parsing preserves parentheses and ignores trailing app details', async (t) => {
  for (const model of ['moto g(50)', 'moto g(9) play']) {
    await t.test(model, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: `Mozilla/5.0 (Linux; Android 12; ${model} Build/S1RFS32.27-25-2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36 Instagram 400.0.0.40.73 Android (extra app details)`,
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.model, model)
      assert.equal(details.modelSource, 'user-agent')
      assert.equal(details.manufacturer, 'Motorola')
      assert.equal(details.browser.name, 'Instagram')
    })
  }
  const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
    userAgent: 'Mozilla/5.0 (Linux; Android 12; moto g(50) Build/S1RFS32.27-25-2) AppleWebKit/537.36 Chrome/141.0.0.0 Mobile Safari/537.36',
    userAgentData: { brands: [], platform: 'Android', mobile: true, getHighEntropyValues: async () => ({ model: 'moto g(50) 5G' }) },
  }) })
  const details = await api.getDeviceInfo()
  assert.equal(details.model, 'moto g(50) 5G')
  assert.equal(details.modelSource, 'client-hints')
})

test('device report conservative iOS policy includes frozen patch-version tokens', async (t) => {
  const cases = [
    { name: 'Facebook with ambiguous 18.6.2', token: '18_6_2', marker: '[FBAN/FBIOS;FBAV/530.0.0.40.103;FBSV/26.1]', version: null },
    { name: 'Chrome with ambiguous 18.7.1', token: '18_7_1', marker: 'CriOS/141.0.7390.96', version: null },
    { name: 'Safari 26 with frozen patch token', token: '18_6_2', marker: 'Version/26.1 Safari/604.1', version: null },
    { name: 'exposed current OS version', token: '26_1', marker: 'CriOS/141.0.7390.96', version: '26.1' },
    { name: 'Safari with genuine older patch version', token: '18_6_2', marker: 'Version/18.6.2 Safari/604.1', version: '18.6.2' },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS ${item.token} like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ${item.marker}`,
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.osVersion, item.version)
      assert.equal(details.osVersionSource, item.version ? 'user-agent' : null)
    })
  }
})

test('device report Chromium client hints retain full versions without hiding named browsers', async (t) => {
  const chromium = { brand: 'Chromium', version: '151.0.7922.34' }
  const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36'
  const cases = [
    { name: 'Chromium-only hints', ua, brands: [chromium], browser: 'Chromium', version: chromium.version, source: 'client-hints' },
    { name: 'Google Chrome brand wins', ua, brands: [chromium, { brand: 'Google Chrome', version: '151.0.7922.34' }], browser: 'Chrome', version: chromium.version, source: 'client-hints' },
    { name: 'Edge token wins over engine hint', ua: ua + ' EdgA/151.0.4022.11', brands: [chromium], browser: 'Edge', version: '151.0.4022.11', source: 'user-agent' },
    { name: 'Samsung token wins over engine hint', ua: ua + ' SamsungBrowser/29.0', brands: [chromium], browser: 'Samsung Internet', version: '29.0', source: 'user-agent' },
    { name: 'unnamed WebView stays a WebView', ua: ua.replace('Pixel 7)', 'Pixel 7; wv)'), brands: [chromium], browser: 'Android WebView', version: null, source: null },
  ]
  for (const item of cases) {
    await t.test(item.name, async () => {
      const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
        userAgent: item.ua,
        userAgentData: {
          brands: item.brands.map((entry) => ({ ...entry, version: '151' })), platform: 'Android', mobile: true,
          getHighEntropyValues: async () => ({ fullVersionList: item.brands }),
        },
      }) })
      const details = await api.getDeviceInfo()
      assert.equal(details.browser.name, item.browser)
      assert.equal(details.browser.version, item.version)
      assert.equal(details.browser.versionSource, item.source)
    })
  }
})

test('device browser names distinguish Quest and Silk from compatibility tokens', async (t) => {
  const cases = [
    { name: 'Quest 3', ua: 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/39.2.0.0.56.754450099 Chrome/136.0.7103.177 VR Safari/537.36', browser: 'Meta Quest Browser', version: '39.2.0.0.56.754450099' },
    { name: 'Quest 2 with Samsung compatibility token', ua: 'Mozilla/5.0 (X11; Linux x86_64; Quest 2) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/18.1.0.2.46.337441587 SamsungBrowser/4.0 Chrome/95.0.4638.74 VR Safari/537.36', browser: 'Meta Quest Browser', version: '18.1.0.2.46.337441587' },
    { name: 'Silk tablet', ua: 'Mozilla/5.0 (Linux; Android 4.4.3; KFTHWI Build/KTU84M) AppleWebKit/537.36 (KHTML, like Gecko) Silk/44.1.54 like Chrome/44.0.2403.63 Safari/537.36', browser: 'Silk', version: '44.1.54' },
    { name: 'Silk desktop view', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Silk/44.1.54 like Chrome/44.0.2403.63 Safari/537.36', browser: 'Silk', version: '44.1.54' },
    { name: 'Silk legacy version suffix', ua: 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_3; en-us; Silk/1.0.13.81_10003810) AppleWebKit/533.16 (KHTML, like Gecko) Version/5.0 Safari/533.16 Silk-Accelerated=true', browser: 'Silk', version: '1.0.13.81_10003810' },
  ]
  for (const item of cases) {
    for (const withHints of [false, true]) {
      await t.test(`${item.name}, client hints ${withHints}`, async () => {
        const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
          userAgent: item.ua,
          ...(withHints ? { userAgentData: { brands: [{ brand: 'Chromium', version: '136' }], platform: 'Linux', mobile: false } } : {}),
        }) })
        const details = await api.getDeviceInfo()
        assert.equal(details.browser.name, item.browser)
        assert.equal(details.browser.version, item.version)
        assert.equal(details.browser.versionSource, 'user-agent')
        if (item.browser === 'Meta Quest Browser') assert.equal(details.deviceType, 'xr')
      })
    }
  }
  // amazon explicitly excludes playstation from its silk detector.
  const api = await loadDeviceInfoForTest({ window: deviceWindowForTest({
    userAgent: 'Mozilla/5.0 (PlayStation Vita 3.61) AppleWebKit/537.73 (KHTML, like Gecko) Silk/3.2',
  }) })
  assert.notEqual((await api.getDeviceInfo()).browser.name, 'Silk')
})
