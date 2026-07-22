import http from 'node:http'
import chalk from 'chalk'
import { section, warn, fail, muted, strong } from '../ui/banner.js'
import { readCurrentPackageJson, maxWatchBodyBytes, watchPortStart } from '../shared.js'

export const collectRequestBody = (req) => new Promise((resolve, reject) => {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk
    if (body.length > maxWatchBodyBytes) {
      reject(new Error('Request body too large'))
      req.destroy()
    }
  })
  req.on('end', () => resolve(body))
  req.on('error', reject)
})

export const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(payload))
}

export const isAllowedHost = (req, port) => {
  const host = req.headers.host
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`
}

export const findLocalPort = (preferredPort) => new Promise((resolve, reject) => {
  const probe = http.createServer()
  probe.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      resolve(findLocalPort(preferredPort + 1))
      return
    }
    reject(error)
  })
  probe.once('listening', () => {
    const { port } = probe.address()
    probe.close(() => resolve(port))
  })
  probe.listen(preferredPort, '127.0.0.1')
})

export const findWatchPort = (preferredPort) => findLocalPort(preferredPort)

export const sanitizeForTerminal = (value) =>
  Array.from(String(value))
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code === 9 || code === 10) return ch
      if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return ''
      return ch
    })
    .join('')

export const printFrontendLog = (payload) => {
  const ok = payload.ok === true
  const status = ok ? chalk.green(sanitizeForTerminal(payload.status)) : chalk.red(sanitizeForTerminal(payload.status))
  const method = chalk.hex('#6FA8DC').bold(sanitizeForTerminal(String(payload.method || 'GET').toUpperCase()))
  const duration = chalk.gray(`${Number(payload.durationMs) || 0}ms`)
  const url = chalk.white(sanitizeForTerminal(String(payload.url || 'unknown url')))
  const time = chalk.gray(new Date().toLocaleTimeString())

  console.log(`${time} ${method} ${status} ${duration}`)
  console.log(`${muted('url')}      ${url}`)

  if (payload.response) {
    console.log(`${muted(sanitizeForTerminal(payload.bodyLabel || 'response'))}`)
    sanitizeForTerminal(String(payload.response))
      .split('\n')
      .forEach((line) => console.log(`  ${chalk.white(line)}`))
  }

  console.log('')
}

export const watchFrontendLogs = async () => {
  try {
    const packageJson = await readCurrentPackageJson()
    const dependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    }

    if (!dependencies.react) {
      throw new Error('This folder does not look like a React project.')
    }

    const port = await findWatchPort(watchPortStart)
    const server = http.createServer(async (req, res) => {
      try {
        if (!isAllowedHost(req, port)) {
          sendJson(res, 403, { ok: false, error: 'Invalid host header' })
          return
        }

        if (req.method === 'OPTIONS') {
          sendJson(res, 204, {})
          return
        }

        if (req.method !== 'POST' || req.url !== '/api/watch-log') {
          sendJson(res, 404, { ok: false, error: 'Not found' })
          return
        }

        const body = await collectRequestBody(req)
        const payload = JSON.parse(body || '{}')

        printFrontendLog(payload)
        sendJson(res, 200, { ok: true })
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message })
      }
    })

    server.listen(port, '127.0.0.1', () => {
      section('watch logs', 'streaming frontend response payloads')
      console.log(`${muted('listen')}    ${strong(`http://127.0.0.1:${port}/api/watch-log`)}`)
      console.log(`${muted('scope')}     ${chalk.white('127.0.0.1 only · localhost CORS enabled')}`)
      console.log(`${muted('status')}    ${chalk.green('ready for frontend requests (press Ctrl+C to stop)')}\n`)
    })
  } catch (error) {
    fail(error.message)
  }
}
