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
