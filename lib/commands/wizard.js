import http from 'node:http'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import chalk from 'chalk'
import { section, muted, strong } from '../ui/banner.js'
import { folderOptions, packageOptions, setupLaunchChoices, folderFlags } from '../ui/banner.js'
import { pathExists, readFile, rootDir, setupUiPortStart, projectNameRegex } from '../shared.js'
import { isAllowedHost, collectRequestBody, sendJson, findLocalPort } from './watch.js'

export const validateSelectionValues = (label, values, allowedValues) => {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`)

  const allowed = new Set(allowedValues)
  const clean = []

  values.forEach((value) => {
    if (typeof value !== 'string' || !allowed.has(value)) {
      throw new Error(`Invalid ${label} selection: ${String(value)}`)
    }

    if (!clean.includes(value)) clean.push(value)
  })

  return clean
}

export const normalizeUiSelections = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid setup payload')
  }

  let projectName = undefined
  if (payload.projectName && typeof payload.projectName === 'string' && payload.projectName.trim()) {
    projectName = payload.projectName.trim()
    if (!projectNameRegex.test(projectName) || projectName.includes('..') || projectName.includes('/')) {
      throw new Error(`Invalid project name: ${projectName}`)
    }
  }

  const selectedPackages = validateSelectionValues(
    'package',
    payload.packages || [],
    packageOptions.map((option) => option.value),
  )
  const selectedStructure = validateSelectionValues(
    'structure',
    payload.structure || [],
    folderOptions.map((option) => option.value),
  )
  const selectedLaunch = validateSelectionValues(
    'launch',
    payload.launch || [],
    setupLaunchChoices.map((option) => option.value),
  )
  const selectedFeatures = selectedStructure.filter((value) => folderFlags.includes(value))
  const selectedFolders = selectedStructure.filter((value) => !folderFlags.includes(value))

  const devServerPort = payload.devServerPort ? parseInt(payload.devServerPort, 10) : 5173
  if (isNaN(devServerPort) || devServerPort < 1 || devServerPort > 65535) {
    throw new Error('Invalid development server port (must be between 1 and 65535)')
  }

  const createdFiles = Array.isArray(payload.createdFiles) ? payload.createdFiles : []
  const validFolders = folderOptions.filter((o) => !folderFlags.includes(o.value)).map((o) => o.value)
  createdFiles.forEach((file) => {
    if (!file || typeof file !== 'object' || !file.name || !file.folder || !file.ext) {
      throw new Error('Invalid file entry in createdFiles')
    }
    if (!validFolders.includes(file.folder)) {
      throw new Error(`Invalid target folder for custom file: ${file.folder}`)
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(file.name)) {
      throw new Error(`Invalid custom file name format: ${file.name}`)
    }
    if (file.ext !== '.jsx' && file.ext !== '.js') {
      throw new Error(`Invalid custom file extension: ${file.ext}`)
    }
  })

  return {
    projectName,
    selectedPackages,
    selectedSetup: [...selectedPackages, ...selectedFeatures],
    selectedFolders,
    shouldRunDevServer: selectedLaunch.includes('runDevServer'),
    devServerPort,
    createdFiles,
  }
}

export const createSetupUiHtml = async ({ displayName, token, submitUrl, timeLeftMs }) => {
  const templatePath = path.join(rootDir, 'templates', 'setup-ui', 'index.html')
  const rawHtml = await readFile(templatePath)

  const safeName = displayName || ''
  return rawHtml
    .replace(/__PROJECT_NAME__/g, safeName)
    .replace(/__SESSION_TOKEN__/g, token)
    .replace(/__SUBMIT_URL__/g, submitUrl)
    .replace(/__TIME_LEFT_MS__/g, String(timeLeftMs))
}

export const readSetupUiStyle = async () => {
  const cssPath = path.join(rootDir, 'templates', 'setup-ui', 'style.css')
  return readFile(cssPath)
}

export const startSetupWizardServer = async ({ displayName = '' } = {}) => {
  const token = randomBytes(24).toString('hex')
  const preferredPort = setupUiPortStart
  const port = await findLocalPort(preferredPort)
  const submitUrl = `http://127.0.0.1:${port}/api/setup`
  const startTime = Date.now()

  let server
  let timeout

  const selections = await new Promise((resolve, reject) => {
    let resolved = false

    const close = (callback) => {
      clearTimeout(timeout)
      if (!server || !server.listening) {
        callback()
        return
      }
      server.close(callback)
    }

    const finish = (callback) => {
      if (resolved) return
      resolved = true
      close(callback)
    }

    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)

        if (!isAllowedHost(req, port)) {
          sendJson(res, 403, { ok: false, error: 'Invalid host header' })
          return
        }

        if (req.method === 'OPTIONS') {
          sendJson(res, 204, {})
          return
        }

        if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/') {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
          })
          const elapsed = Date.now() - startTime
          const timeLeftMs = Math.max(0, 10 * 60 * 1000 - elapsed)
          const dynamicHtml = await createSetupUiHtml({ displayName, token, submitUrl, timeLeftMs })
          res.end(dynamicHtml)
          return
        }

        if (req.method === 'GET' && url.pathname === '/style.css') {
          const css = await readSetupUiStyle()
          res.writeHead(200, {
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
          })
          res.end(css)
          return
        }

        if (req.method === 'POST' && url.pathname === '/api/setup') {
          const body = await collectRequestBody(req)
          const payload = JSON.parse(body || '{}')
          if (payload.token !== token) {
            sendJson(res, 403, { ok: false, error: 'Invalid setup session token' })
            return
          }

          const normalized = normalizeUiSelections(payload)
          sendJson(res, 200, { ok: true, message: 'Setup received. Continue in terminal.' })
          finish(() => resolve(normalized))
          return
        }

        if (req.method === 'POST' && url.pathname === '/api/cancel') {
          const body = await collectRequestBody(req)
          const payload = JSON.parse(body || '{}')
          if (payload.token !== token) {
            sendJson(res, 403, { ok: false, error: 'Invalid setup session token' })
            return
          }

          sendJson(res, 200, { ok: true, message: 'Setup cancelled.' })
          setTimeout(() => {
            finish(() => reject(new Error('Setup cancelled by user')))
          }, 100)
          return
        }

        if (req.method === 'GET') {
          const errHtmlPath = path.join(rootDir, 'templates', 'setup-ui', '404.html')
          if (await pathExists(errHtmlPath)) {
            const rawErrHtml = await readFile(errHtmlPath)
            const errHtml = rawErrHtml.replace(/__SESSION_TOKEN__/g, token)
            res.writeHead(404, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store, max-age=0',
            })
            res.end(errHtml)
            return
          }
        }

        sendJson(res, 404, { ok: false, error: 'Not found' })
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message })
      }
    })

    server.once('error', (error) => finish(() => reject(error)))
    server.listen(port, '127.0.0.1', () => {
      section('setup ui', 'local browser wizard')
      console.log(`${muted('open')}     ${strong(`http://127.0.0.1:${port}/?token=${token}`)}`)
      console.log(`${muted('project')}  ${strong(displayName || '(Select project name in web GUI)')}`)
      console.log(`${muted('scope')}    ${chalk.white('127.0.0.1 only · browser selections are validated again in the CLI')}`)
      console.log(`${muted('timeout')}  ${chalk.white('10 minutes')}\n`)
    })

    timeout = setTimeout(() => {
      finish(() => reject(new Error('Setup UI timed out after 10 minutes')))
    }, 10 * 60 * 1000)
  })

  return selections
}
