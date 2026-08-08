import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUiSelections } from '../src/commands/wizard.js'

test('normalizeUiSelections parses valid project name and options', () => {
  const result = normalizeUiSelections({
    projectName: 'my-custom-app',
    packages: ['tailwind', 'axios'],
    structure: ['components', 'pages'],
    launch: ['runDevServer'],
    devServerPort: '5173',
  })

  assert.equal(result.projectName, 'my-custom-app')
  assert.deepEqual(result.selectedPackages, ['tailwind', 'axios'])
  assert.deepEqual(result.selectedFolders, ['components', 'pages'])
  assert.equal(result.shouldRunDevServer, true)
  assert.equal(result.devServerPort, 5173)
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

  assert.equal(resolvePackageName('tailwind@latest'), 'tailwindcss@latest')
  assert.equal(resolvePackageName('react@18.3.1'), 'react@18.3.1')
  assert.equal(resolvePackageName('@tailwindcss/vite'), '@tailwindcss/vite')
})

test('form generator helpers parse fields and input types correctly', async () => {
  const { extractRawFormFields, getFieldInputType, formatFieldLabel } = await import('../src/generators/form.js')

  assert.deepEqual(extractRawFormFields(['--form', 'name', 'user_email', 'phone']), ['name', 'user_email', 'phone'])
  assert.equal(getFieldInputType('password'), 'password')
  assert.equal(getFieldInputType('user_email'), 'email')
  assert.equal(getFieldInputType('phone'), 'tel')
  assert.equal(formatFieldLabel('user_email'), 'User Email')
})

test('registerAllCommands correctly registers all modular commands', async () => {
  const { Command } = await import('commander')
  const { registerAllCommands } = await import('../src/commands/cli/index.js')

  const program = new Command()
  program.name('react')

  registerAllCommands(program)

  const commandNames = program.commands.map((cmd) => cmd.name())
  const expectedCommands = ['zecron', 'watch', 'list', 'doctor', 'audit', 'update', 'run', 'asset', 'env', 'set', 'make', 'push']

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
