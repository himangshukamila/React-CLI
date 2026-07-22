import path from 'node:path'
import chalk from 'chalk'
import { section, pass, warn, fail, accent } from '../ui/banner.js'
import { pathExists, readFile, readTextIfExists, writeFile, envKeyRegex } from '../shared.js'

export const parseEnvFile = (content) => {
  const lines = content ? content.split('\n') : []
  const entries = new Map()

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return
    const index = trimmed.indexOf('=')
    entries.set(trimmed.slice(0, index), trimmed.slice(index + 1))
  })

  return entries
}

export const writeEnvEntries = async (entries) => {
  const content = [...entries.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  await writeFile(path.join(process.cwd(), '.env'), `${content}${content ? '\n' : ''}`)
}

export const validateEnvKey = (key) => {
  if (!envKeyRegex.test(key)) {
    throw new Error('Env key must start with VITE_ and use uppercase letters, numbers, and underscores')
  }
}

export const envList = async () => {
  try {
    const envPath = path.join(process.cwd(), '.env')
    section('env', 'list variables')

    if (!(await pathExists(envPath))) {
      warn('.env missing')
      return
    }

    const entries = parseEnvFile(await readFile(envPath))
    if (entries.size === 0) {
      warn('no variables found')
      return
    }

    entries.forEach((value, key) => {
      console.log(`${accent(key.padEnd(22))}${chalk.white(value)}`)
    })
  } catch (error) {
    fail(error.message)
  }
}

export const envAdd = async (key, value) => {
  try {
    validateEnvKey(key)

    if (typeof value !== 'string' || value.includes('\n') || value.includes('\r')) {
      throw new Error('Env value must be a single line')
    }

    const envPath = path.join(process.cwd(), '.env')
    const entries = parseEnvFile(await readTextIfExists(envPath))
    const existed = entries.has(key)
    entries.set(key, value)
    await writeEnvEntries(entries)
    pass(existed ? `updated ${key}` : `added ${key}`)
  } catch (error) {
    fail(error.message)
  }
}

export const envRemove = async (key) => {
  try {
    validateEnvKey(key)

    const envPath = path.join(process.cwd(), '.env')
    const entries = parseEnvFile(await readTextIfExists(envPath))

    if (!entries.has(key)) {
      warn(`${key} not found`)
      return
    }

    entries.delete(key)
    await writeEnvEntries(entries)
    pass(`removed ${key}`)
  } catch (error) {
    fail(error.message)
  }
}
