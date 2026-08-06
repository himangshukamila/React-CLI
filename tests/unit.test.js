import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUiSelections } from '../lib/commands/wizard.js'

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
  const { getBasePackageName, resolvePackageName } = await import('../lib/shared.js')

  assert.equal(getBasePackageName('react@18.3.1'), 'react')
  assert.equal(getBasePackageName('@tailwindcss/vite@latest'), '@tailwindcss/vite')
  assert.equal(getBasePackageName('tailwind@latest'), 'tailwind')

  assert.equal(resolvePackageName('tailwind@latest'), 'tailwindcss@latest')
  assert.equal(resolvePackageName('react@18.3.1'), 'react@18.3.1')
  assert.equal(resolvePackageName('@tailwindcss/vite'), '@tailwindcss/vite')
})

test('form generator helpers parse fields and input types correctly', async () => {
  const { extractRawFormFields, getFieldInputType, formatFieldLabel } = await import('../lib/generators/form.js')

  assert.deepEqual(extractRawFormFields(['--form', 'name', 'user_email', 'phone']), ['name', 'user_email', 'phone'])
  assert.equal(getFieldInputType('password'), 'password')
  assert.equal(getFieldInputType('user_email'), 'email')
  assert.equal(getFieldInputType('phone'), 'tel')
  assert.equal(formatFieldLabel('user_email'), 'User Email')
})
