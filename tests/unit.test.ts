import test from 'node:test'
import assert from 'node:assert/strict'
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
  const expectedCommands = ['zecron', 'watch', 'list', 'doctor', 'audit', 'update', 'run', 'build', 'open', 'asset', 'env', 'set', 'make', 'push']

  for (const name of expectedCommands) {
    assert.ok(commandNames.includes(name), `Command ${name} should be registered`)
  }
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


