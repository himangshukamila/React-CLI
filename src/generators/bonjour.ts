import path from 'node:path'
import chalk from 'chalk'
import { section, pass, fail, typeText } from '../ui/banner.js'
import { ensureDir, writeFile, readFile, pathExists } from '../shared.js'

export const configureBonjourBoilerplate = async (targetPath?: string): Promise<void> => {
  try {
    const projectRoot = targetPath || process.cwd()
    const pkgJsonPath = path.join(projectRoot, 'package.json')

    if (!(await pathExists(pkgJsonPath))) {
      throw new Error('Not inside a valid project folder (package.json missing).')
    }

    section('bonjour generator', 'scaffolding mDNS service discovery server and client components')

    // create server directory and files
    const serverDir = path.join(projectRoot, 'server')
    await ensureDir(serverDir)

    const mdnsScannerContent = `import { Bonjour } from 'bonjour-service'
import { EventEmitter } from 'node:events'

// human friendly labels for well known mdns service types
const KNOWN_TYPES = {
  http: { label: 'Web server', icon: 'globe' },
  https: { label: 'Secure web server', icon: 'globe' },
  ws: { label: 'WebSocket', icon: 'plug' },
  wss: { label: 'Secure WebSocket', icon: 'plug' },
  workstation: { label: 'Workstation', icon: 'desktop' },
  'device-info': { label: 'Device info', icon: 'chip' },
  ssh: { label: 'SSH', icon: 'terminal' },
  printer: { label: 'Printer', icon: 'printer' },
  scanner: { label: 'Scanner', icon: 'printer' },
  airplay: { label: 'AirPlay', icon: 'cast' },
  googlecast: { label: 'Chromecast', icon: 'cast' },
}

function describeType(type) {
  const known = KNOWN_TYPES[type]
  if (known) return known
  return { label: type, icon: 'service' }
}

function buildUrl(service) {
  const rawHost = service.addresses?.find((a) => a.includes('.')) || service.host
  if (!rawHost) return null
  const host = rawHost.replace(/\.$/, '')
  const scheme = {
    http: 'http',
    https: 'https',
    ws: 'ws',
    wss: 'wss',
  }[service.type] || 'http'
  const path = service.txt?.path && service.txt.path.startsWith('/') ? service.txt.path : ''
  return \`\${scheme}://\${host}:\${service.port}\${path}\`
}

function serialize(service) {
  const meta = describeType(service.type)
  return {
    id: service.fqdn,
    name: service.name,
    type: service.type,
    protocol: service.protocol,
    kind: meta.label,
    icon: meta.icon,
    host: service.host,
    port: service.port,
    fqdn: service.fqdn,
    addresses: service.addresses || [],
    txt: service.txt && Object.keys(service.txt).length ? service.txt : null,
    subtypes: service.subtypes || [],
    url: buildUrl(service),
    lastSeen: Date.now(),
  }
}

export class MdnsScanner extends EventEmitter {
  constructor() {
    super()
    this.bonjour = null
    this.browser = null
    this.services = new Map()
    this.expiryTimer = null
    this.scanning = false
    this.startedAt = null
  }

  start() {
    if (this.scanning) {
      this.refresh()
      return
    }
    this.scanning = true
    this.startedAt = Date.now()
    this.bonjour = new Bonjour()
    this.browser = this.bonjour.find(null)

    this.browser.on('up', (service) => this.#track('up', service))
    this.browser.on('down', (service) => this.#remove(service))
    this.browser.on('srv-update', (service) => this.#track('update', service))
    this.browser.on('txt-update', (service) => this.#track('update', service))

    this.expiryTimer = setInterval(() => {
      try {
        this.browser?.expire()
      } catch {
        /* ignore */
      }
    }, 5000)
    this.expiryTimer.unref?.()
  }

  #track(reason, service) {
    const data = serialize(service)
    const existed = this.services.has(data.id)
    this.services.set(data.id, data)
    this.emit(existed ? 'update' : 'up', data)
  }

  #remove(service) {
    const id = service.fqdn
    const data = this.services.get(id)
    if (!data) return
    this.services.delete(id)
    this.emit('down', data)
  }

  refresh() {
    try {
      this.browser?.update()
    } catch {
      /* ignore */
    }
  }

  list() {
    return [...this.services.values()]
  }

  status() {
    return {
      scanning: this.scanning,
      startedAt: this.startedAt,
      count: this.services.size,
    }
  }

  stop() {
    if (this.expiryTimer) clearInterval(this.expiryTimer)
    this.expiryTimer = null
    try {
      this.browser?.stop()
    } catch {
      /* ignore */
    }
    try {
      this.bonjour?.destroy()
    } catch {
      /* ignore */
    }
    this.browser = null
    this.bonjour = null
    this.scanning = false
    this.services.clear()
  }
}

let shared = null
export function getScanner() {
  if (!shared) shared = new MdnsScanner()
  return shared
}
`

    await writeFile(path.join(serverDir, 'mdnsScanner.js'), mdnsScannerContent)
    pass('created server/mdnsScanner.js')

    const vitePluginMdnsContent = `import { getScanner } from './mdnsScanner.js'
import fs from 'node:fs'
import path from 'node:path'

const MAX_BODY_BYTES = 64 * 1024

// check if request origin and host match local development address
function isLocalOrigin(req) {
  const host = req.headers.host || ''
  const origin = req.headers.origin || ''
  const isAllowedHost = host.startsWith('localhost:') || host.startsWith('127.0.0.1:') || host === 'localhost' || host === '127.0.0.1'
  if (!isAllowedHost) return false
  if (origin) {
    try {
      const parsedOrigin = new URL(origin)
      return parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1'
    } catch {
      return false
    }
  }
  return true
}

// collect request body with maximum byte size guard
function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('Request payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

// validate target service url to prevent crlf injection and enforce http protocols
function validateTargetUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null
  const trimmed = rawUrl.trim()
  if (trimmed.includes('\\n') || trimmed.includes('\\r')) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin + (parsed.pathname !== '/' ? parsed.pathname : '')
  } catch {
    return null
  }
}

// vite plugin that handles mdns scanning, sse streaming, and env variable updates
export function mdnsPlugin() {
  return {
    name: 'vite-plugin-mdns',
    configureServer(server) {
      const scanner = getScanner()
      let activeStreams = 0

      const json = (res, body, status = 200) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      }

      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || '').split('?')[0]

        if (!urlPath.startsWith('/api/')) {
          return next()
        }

        if (!isLocalOrigin(req)) {
          return json(res, { error: 'Forbidden origin or host' }, 403)
        }

        if (urlPath === '/api/status') {
          if (req.method !== 'GET') return json(res, { error: 'Use GET' }, 405)
          return json(res, scanner.status())
        }

        if (urlPath === '/api/services') {
          if (req.method !== 'GET') return json(res, { error: 'Use GET' }, 405)
          return json(res, scanner.list())
        }

        if (urlPath === '/api/scan') {
          if (req.method !== 'POST') return json(res, { error: 'Use POST' }, 405)
          scanner.start()
          return json(res, scanner.status())
        }

        if (urlPath === '/api/stop') {
          if (req.method !== 'POST') return json(res, { error: 'Use POST' }, 405)
          scanner.stop()
          return json(res, scanner.status())
        }

        if (urlPath === '/api/select-service') {
          if (req.method !== 'POST') return json(res, { error: 'Use POST' }, 405)

          collectBody(req)
            .then((body) => {
              let data = {}
              try {
                data = JSON.parse(body || '{}')
              } catch {
                return json(res, { error: 'Invalid JSON payload' }, 400)
              }

              if (!data || typeof data !== 'object' || Array.isArray(data)) {
                return json(res, { error: 'Payload must be an object' }, 400)
              }

              const rawUrl = data.url || (data.host ? \`http://\${data.host}:\${data.port || 80}\` : '')
              const targetUrl = validateTargetUrl(rawUrl)

              if (!targetUrl) {
                return json(res, { error: 'Invalid service target URL' }, 400)
              }

              try {
                const envPath = path.join(process.cwd(), '.env')
                let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''

                if (/^VITE_SERVER_URL=/m.test(envContent)) {
                  envContent = envContent.replace(/^VITE_SERVER_URL=.*$/m, \`VITE_SERVER_URL=\${targetUrl}\`)
                } else {
                  envContent += \`\\nVITE_SERVER_URL=\${targetUrl}\`
                }

                if (/^VITE_BONJOUR_SERVICE_URL=/m.test(envContent)) {
                  envContent = envContent.replace(/^VITE_BONJOUR_SERVICE_URL=.*$/m, \`VITE_BONJOUR_SERVICE_URL=\${targetUrl}\`)
                } else {
                  envContent += \`\\nVITE_BONJOUR_SERVICE_URL=\${targetUrl}\`
                }

                fs.writeFileSync(envPath, envContent.trim() + '\\n')
                return json(res, { ok: true, url: targetUrl })
              } catch (err) {
                console.error('failed to update .env:', err)
                return json(res, { error: 'Failed to update environment configuration' }, 500)
              }
            })
            .catch((err) => json(res, { error: err.message }, 400))
          return
        }

        if (urlPath === '/api/stream') {
          if (req.method !== 'GET') return json(res, { error: 'Use GET' }, 405)

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          })

          const send = (event, data) => {
            try {
              res.write(\`event: \${event}\\n\`)
              res.write(\`data: \${JSON.stringify(data)}\\n\\n\`)
            } catch {
              /* ignore write error on closed connection */
            }
          }

          activeStreams += 1
          if (activeStreams === 1) {
            scanner.start()
          }

          send('snapshot', scanner.list())

          const onUp = (s) => send('up', s)
          const onDown = (s) => send('down', s)
          const onUpdate = (s) => send('update', s)
          scanner.on('up', onUp)
          scanner.on('down', onDown)
          scanner.on('update', onUpdate)

          const ping = setInterval(() => {
            try {
              res.write(': ping\\n\\n')
            } catch {
              /* ignore ping error */
            }
          }, 20000)

          req.on('close', () => {
            clearInterval(ping)
            scanner.off('up', onUp)
            scanner.off('down', onDown)
            scanner.off('update', onUpdate)

            activeStreams = Math.max(0, activeStreams - 1)
            if (activeStreams === 0) {
              scanner.stop()
            }
          })
          return
        }

        next()
      })

      const onSigInt = () => scanner.stop()
      const onSigTerm = () => scanner.stop()
      process.once('SIGINT', onSigInt)
      process.once('SIGTERM', onSigTerm)

      server.httpServer?.on('close', () => {
        scanner.stop()
        process.off('SIGINT', onSigInt)
        process.off('SIGTERM', onSigTerm)
      })
    },
  }
}

export default mdnsPlugin
`

    await writeFile(path.join(serverDir, 'vitePluginMdns.js'), vitePluginMdnsContent)
    pass('created server/vitePluginMdns.js')

    // update vite.config.js or vite.config.ts if present
    const viteConfigJsPath = path.join(projectRoot, 'vite.config.js')
    const viteConfigTsPath = path.join(projectRoot, 'vite.config.ts')
    const targetViteConfigPath = (await pathExists(viteConfigTsPath))
      ? viteConfigTsPath
      : viteConfigJsPath

    if (await pathExists(targetViteConfigPath)) {
      let configContent = await readFile(targetViteConfigPath)
      if (!configContent.includes('vitePluginMdns')) {
        configContent = `import { mdnsPlugin } from './server/vitePluginMdns.js'\n` + configContent
        if (/plugins:\s*\[/.test(configContent)) {
          configContent = configContent.replace(/plugins:\s*\[/, 'plugins: [mdnsPlugin(), ')
        }
        await writeFile(targetViteConfigPath, configContent)
        pass(`updated ${path.basename(targetViteConfigPath)} with mdnsPlugin`)
      }
    }

    // create src/services/useServiceScanner.js
    const servicesDir = path.join(projectRoot, 'src', 'services')
    await ensureDir(servicesDir)

    const bonjourServiceContent = `const LOCAL_STORAGE_KEY = 'serverIp'

// get env server ip from vite environment variables
export function getEnvServerIp() {
  const envUrl = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_BONJOUR_SERVICE_URL || import.meta.env.VITE_SERVER_IP
  if (envUrl) {
    return envUrl.trim()
  }
  return ''
}

// get active server address from localstorage with env fallback
export function getServerIp() {
  const saved = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null
  if (saved) {
    return saved
  }
  return getEnvServerIp()
}

// set selected server ip in localstorage and dispatch change event
export function setServerIp(ipInput) {
  if (!ipInput || typeof window === 'undefined') return
  const cleanAddress = ipInput.trim()
  localStorage.setItem(LOCAL_STORAGE_KEY, cleanAddress)
  window.dispatchEvent(
    new CustomEvent('serverIpChanged', { detail: cleanAddress })
  )
}

// get api base url based on current server address
export function getApiBaseUrl() {
  const address = getServerIp()
  if (!address) return ''
  if (address.startsWith('http://') || address.startsWith('https://')) {
    return address
  }
  return \`http://\${address}\`
}

// get websocket base url based on current server address
export function getWsBaseUrl() {
  const address = getServerIp()
  if (!address) return ''
  if (address.startsWith('ws://') || address.startsWith('wss://')) {
    return address
  }
  const cleanAddress = address.replace(/^https?:\\/\\//, '')
  return \`ws://\${cleanAddress}\`
}
`

    await writeFile(path.join(servicesDir, 'bonjour.js'), bonjourServiceContent)
    pass('created src/services/bonjour.js')

    const useServiceScannerContent = `import { useState, useEffect } from 'react'

// custom react hook to stream mdns service updates via sse
export function useServiceScanner() {
  const [services, setServices] = useState([])
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    setScanning(true)
    const eventSource = new EventSource('/api/stream')

    eventSource.addEventListener('snapshot', (e) => {
      try {
        const data = JSON.parse(e.data)
        setServices(data)
      } catch (err) {
        /* ignore parse error */
      }
    })

    eventSource.addEventListener('up', (e) => {
      try {
        const service = JSON.parse(e.data)
        setServices((prev) => {
          const idx = prev.findIndex((s) => s.id === service.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = service
            return updated
          }
          return [...prev, service]
        })
      } catch (err) {
        /* ignore parse error */
      }
    })

    eventSource.addEventListener('down', (e) => {
      try {
        const service = JSON.parse(e.data)
        setServices((prev) => prev.filter((s) => s.id !== service.id))
      } catch (err) {
        /* ignore parse error */
      }
    })

    eventSource.addEventListener('update', (e) => {
      try {
        const service = JSON.parse(e.data)
        setServices((prev) => prev.map((s) => (s.id === service.id ? service : s)))
      } catch (err) {
        /* ignore parse error */
      }
    })

    eventSource.onerror = () => {
      setScanning(false)
    }

    return () => {
      eventSource.close()
      setScanning(false)
    }
  }, [])

  return { services, scanning }
}

export default useServiceScanner
`

    await writeFile(path.join(servicesDir, 'useServiceScanner.js'), useServiceScannerContent)
    pass('created src/services/useServiceScanner.js')

    // create src/pages/DiscoveryPage.jsx
    const pagesDir = path.join(projectRoot, 'src', 'pages')
    await ensureDir(pagesDir)

    const discoveryPageContent = `import React from 'react'
import { useServiceScanner } from '../services/useServiceScanner.js'
import { setServerIp } from '../services/bonjour.js'

// discovery landing page component that searches for bonjour services before entering main app
export const DiscoveryPage = ({ onSelectService }) => {
  const { services, scanning } = useServiceScanner()

  const handleSelect = async (service) => {
    if (service) {
      const targetUrl = service.url || (service.host ? \`http://\${service.host}:\${service.port}\` : '')
      if (targetUrl) {
        // save to localstorage for instant client side switching
        setServerIp(targetUrl)

        try {
          // post payload to server to update .env as default fallback
          await fetch('/api/select-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(service),
          })
        } catch (e) {
          /* ignore env save failure */
        }
      }
    }
    if (onSelectService) onSelectService(service)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Bonjour Service Discovery</h1>
            <p className="text-sm text-slate-400 mt-1">Scanning local network (mDNS/DNS-SD) for active devices</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={\`w-3 h-3 rounded-full \${scanning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}\`}></span>
            <span className="text-xs text-slate-400 font-mono">{scanning ? 'Scanning...' : 'Idle'}</span>
          </div>
        </div>

        {services.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-300 font-medium">Looking for Bonjour services nearby...</p>
            <p className="text-xs text-slate-500 mt-1">Make sure devices are on the same local network.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6 max-h-80 overflow-y-auto pr-1">
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => handleSelect(service)}
                className="group flex items-center justify-between p-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <div>
                  <h3 className="font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {service.host || service.fqdn} : {service.port} ({service.kind})
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelect(service)
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-md"
                >
                  Connect &amp; Enter
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={() => handleSelect(null)}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline"
          >
            Skip to Main Page &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}

export default DiscoveryPage
`

    await writeFile(path.join(pagesDir, 'DiscoveryPage.jsx'), discoveryPageContent)
    pass('created src/pages/DiscoveryPage.jsx')

    // update or create App.jsx to embed discovery flow
    const appJsxPath = path.join(projectRoot, 'src', 'App.jsx')
    const appTsxPath = path.join(projectRoot, 'src', 'App.tsx')
    const targetAppPath = (await pathExists(appTsxPath)) ? appTsxPath : appJsxPath

    if (await pathExists(targetAppPath)) {
      let appContent = await readFile(targetAppPath)
      if (!appContent.includes('DiscoveryPage')) {
        const importLine = `import DiscoveryPage from './pages/DiscoveryPage.jsx'\nimport { useState } from 'react'\n`
        appContent = importLine + appContent
        pass(`added DiscoveryPage import to ${path.basename(targetAppPath)}`)
      }
    } else {
      const defaultAppContent = `import React, { useState } from 'react'
import DiscoveryPage from './pages/DiscoveryPage.jsx'

export default function App() {
  const [selectedService, setSelectedService] = useState(null)
  const [isDiscovered, setIsDiscovered] = useState(false)

  if (!isDiscovered) {
    return (
      <DiscoveryPage
        onSelectService={(service) => {
          setSelectedService(service)
          setIsDiscovered(true)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-4">Main Dashboard</h1>
      {selectedService ? (
        <p className="text-indigo-300">Connected via Bonjour service: {selectedService.name} ({selectedService.host})</p>
      ) : (
        <p className="text-slate-400">Proceeded without specific Bonjour device.</p>
      )}
    </div>
  )
}
`
      await writeFile(appJsxPath, defaultAppContent)
      pass('created src/App.jsx with Bonjour discovery root page flow')
    }

    await typeText(
      chalk.green.bold(
        '\n✅ Bonjour Discovery Service successfully scaffolded!\n' +
          '   Created server/mdnsScanner.js, server/vitePluginMdns.js, src/services/useServiceScanner.js, and src/pages/DiscoveryPage.jsx.\n' +
          '   Note: Run `npm install bonjour-service` to complete package dependencies.'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
