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
