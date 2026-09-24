import path from 'node:path'
import chalk from 'chalk'
import { section, pass, warn, fail, typeText } from '../ui/banner.js'
import {
  ensureDir,
  writeFile,
  readFile,
  readDir,
  removePath,
  pathExists,
  runCommand,
  runPackageInstall,
} from '../shared.js'

export const mdnsPackageName = '4b-react-mdns'

const viteConfigNames = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']
const entryPointNames = ['src/main.jsx', 'src/main.tsx', 'src/index.jsx', 'src/index.tsx']

// files written by the previous hand rolled scanner, now owned by the package
const legacyFiles = [
  'server/mdnsScanner.js',
  'server/vitePluginMdns.js',
  'src/services/useServiceScanner.js',
]

const findFirst = async (projectRoot: string, candidates: string[]): Promise<string | null> => {
  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, ...candidate.split('/'))
    if (await pathExists(fullPath)) return fullPath
  }
  return null
}

// drop the old scanner files and unhook them from the vite config
const removeLegacyScaffold = async (projectRoot: string): Promise<void> => {
  let removed = 0

  for (const relativePath of legacyFiles) {
    const fullPath = path.join(projectRoot, ...relativePath.split('/'))
    if (await pathExists(fullPath)) {
      await removePath(fullPath)
      removed += 1
    }
  }

  const viteConfigPath = await findFirst(projectRoot, viteConfigNames)
  if (viteConfigPath) {
    const before = await readFile(viteConfigPath)
    if (before.includes('server/vitePluginMdns')) {
      const after = before
        .replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]*server\/vitePluginMdns[^'"]*['"];?[ \t]*\r?\n?/gm, '')
        .replace(/\bmdnsPlugin\(\)\s*,?\s*/g, '')
      await writeFile(viteConfigPath, after)
      removed += 1
    }
  }

  const serverDir = path.join(projectRoot, 'server')
  if (await pathExists(serverDir)) {
    const entries = await readDir(serverDir)
    if (entries.length === 0) await removePath(serverDir)
  }

  if (removed > 0) pass('removed the previous hand written mDNS scaffold')
}

// let the package wire itself in: mdnsPlugin() in vite, <MdnsProvider> at the entry point
const runPackageCodemod = async (projectRoot: string): Promise<boolean> => {
  const cliPath = path.join(projectRoot, 'node_modules', mdnsPackageName, 'bin', 'cli.js')
  if (!(await pathExists(cliPath))) return false

  try {
    await runCommand(
      process.execPath,
      [cliPath, 'config', '--http-only', '--no-launcher'],
      { cwd: projectRoot, stdio: 'pipe' },
      'Failed to run 4bmdns config'
    )
    pass('wired mdnsPlugin() and <MdnsProvider> with 4bmdns config')
    return true
  } catch {
    return false
  }
}

// fallback used when the package codemod is unavailable or bails out
const wireManually = async (projectRoot: string): Promise<void> => {
  const viteConfigPath = await findFirst(projectRoot, viteConfigNames)
  if (!viteConfigPath) {
    warn('no vite config found', `add mdnsPlugin() from ${mdnsPackageName}/vite yourself`)
  } else {
    let config = await readFile(viteConfigPath)
    if (!config.includes(`${mdnsPackageName}/vite`)) {
      config = `import { mdnsPlugin } from '${mdnsPackageName}/vite'\n` + config
      if (/plugins\s*:\s*\[/.test(config)) {
        config = config.replace(/plugins\s*:\s*\[/, 'plugins: [mdnsPlugin({ httpOnly: true }), ')
        await writeFile(viteConfigPath, config)
        pass(`added mdnsPlugin() to ${path.basename(viteConfigPath)}`)
      } else {
        warn(`no plugins array in ${path.basename(viteConfigPath)}`, 'add mdnsPlugin({ httpOnly: true }) yourself')
      }
    }
  }

  const entryPath = await findFirst(projectRoot, entryPointNames)
  if (!entryPath) {
    warn('no entry point found', `wrap your app in <MdnsProvider> from ${mdnsPackageName}/react`)
    return
  }

  const entry = await readFile(entryPath)
  if (entry.includes('MdnsProvider')) return

  const renderAt = entry.lastIndexOf('.render(')
  const openAt = renderAt === -1 ? -1 : entry.indexOf('(', renderAt)
  let closeAt = -1
  let depth = 0
  for (let index = openAt; index > -1 && index < entry.length; index += 1) {
    const char = entry[index]
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) {
        closeAt = index
        break
      }
    }
  }

  if (closeAt === -1) {
    warn(`could not wrap ${path.basename(entryPath)}`, `render <MdnsProvider> around your app yourself`)
    return
  }

  const rendered = entry.slice(openAt + 1, closeAt).trim().replace(/,$/, '').trim()
  // the block moves one level deeper inside the provider
  const indented = rendered.split('\n').join('\n  ')
  const wrapped =
    `import { MdnsProvider } from '${mdnsPackageName}/react'\n` +
    entry.slice(0, openAt + 1) +
    `\n  <MdnsProvider launcher={false} httpOnly={true}>\n    ${indented}\n  </MdnsProvider>,\n` +
    entry.slice(closeAt)

  await writeFile(entryPath, wrapped)
  pass(`wrapped ${path.basename(entryPath)} in <MdnsProvider>`)
}

const bonjourServiceContent = `import { getSelectedAddress } from '${mdnsPackageName}/react'

// used until a server is picked from the discovery page
const ENV_URL = (import.meta.env.VITE_SERVER_URL || '').trim().replace(/\\/+$/, '')

// "ip:port" of the server picked on the network, empty when nothing is picked yet
export function getSelectedServer() {
  if (typeof window === 'undefined') return ''
  return getSelectedAddress() || ''
}

// http base url for api calls, falling back to VITE_SERVER_URL from .env
export function getApiBaseUrl() {
  const address = getSelectedServer()
  return address ? \`http://\${address}\` : ENV_URL
}

// websocket base url derived from the same address
export function getWsBaseUrl() {
  const address = getSelectedServer()
  if (address) return \`ws://\${address}\`
  return ENV_URL ? ENV_URL.replace(/^http/i, 'ws') : ''
}

// kept so older imports keep resolving
export const getServerIp = getSelectedServer
export const getEnvServerIp = () => ENV_URL
`

const discoveryPageContent = `import { useMemo, useState } from 'react'
import { filterServices, useMdns } from '${mdnsPackageName}/react'

const styles = \`
.bj-root{position:fixed;inset:0;overflow:auto;display:flex;align-items:center;justify-content:center;padding:24px;background:#08080a;color:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.bj-root::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:32px 32px;-webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 40%,#000 40%,transparent 90%);mask-image:radial-gradient(ellipse 80% 60% at 50% 40%,#000 40%,transparent 90%)}
.bj-root::after{content:"";position:fixed;top:38%;left:50%;width:700px;height:700px;transform:translate(-50%,-50%);pointer-events:none;filter:blur(40px);background:radial-gradient(circle,rgba(232,147,90,.10) 0%,rgba(232,147,90,.03) 45%,transparent 70%)}
.bj-panel{position:relative;z-index:1;width:100%;max-width:880px;padding:28px;border-radius:18px;border:1px solid rgba(232,147,90,.12);background:rgba(12,12,14,.92);box-shadow:0 24px 60px rgba(0,0,0,.55)}
.bj-head{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.06)}
.bj-eyebrow{margin:0 0 8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#e8935a}
.bj-title{margin:0;font-size:22px;font-weight:600;letter-spacing:-.01em}
.bj-sub{margin:6px 0 0;font-size:13px;color:#838389}
.bj-status{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);font-size:12px;color:#b4b4bb;white-space:nowrap}
.bj-dot{width:7px;height:7px;border-radius:50%;background:#4c4c52}
.bj-dot[data-live="true"]{background:#22d3ee;animation:bj-pulse 1.8s infinite}
@keyframes bj-pulse{0%{box-shadow:0 0 0 0 rgba(34,211,238,.45)}70%{box-shadow:0 0 0 7px rgba(34,211,238,0)}100%{box-shadow:0 0 0 0 rgba(34,211,238,0)}}
.bj-tools{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}
.bj-search{flex:1;min-width:180px;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#f4f4f5;font-size:13px;outline:none}
.bj-search:focus{border-color:rgba(232,147,90,.4)}
.bj-search::placeholder{color:#6f6f78}
.bj-chip{padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#b4b4bb;font-size:12px;cursor:pointer;transition:all .15s ease}
.bj-chip:hover{color:#f4f4f5;border-color:rgba(255,255,255,.16)}
.bj-chip[data-on="true"]{border-color:rgba(232,147,90,.4);background:rgba(232,147,90,.12);color:#f2a874}
.bj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;max-height:44vh;overflow:auto;padding:2px}
.bj-card{padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);color:inherit;font:inherit;text-align:left;cursor:pointer;transition:all .15s ease}
.bj-card:hover{border-color:rgba(232,147,90,.35);background:rgba(232,147,90,.05)}
.bj-card[data-selected="true"]{border-color:rgba(232,147,90,.5);background:rgba(232,147,90,.09)}
.bj-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.bj-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bj-kind{padding:3px 8px;border-radius:999px;border:1px solid rgba(232,147,90,.22);background:rgba(232,147,90,.1);color:#e8935a;font-size:10px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.bj-addr{margin-top:9px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#b4b4bb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bj-host{margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#6f6f78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bj-empty{padding:52px 0;text-align:center;color:#838389;font-size:13px}
.bj-ring{width:34px;height:34px;margin:0 auto 16px;border-radius:50%;border:2px solid rgba(232,147,90,.18);border-top-color:#e8935a;animation:bj-spin .9s linear infinite}
@keyframes bj-spin{to{transform:rotate(360deg)}}
.bj-hint{margin:6px 0 0;font-size:12px;color:#4c4c52}
.bj-picked{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:18px;padding:14px 16px;border-radius:12px;border:1px solid rgba(232,147,90,.22);background:rgba(232,147,90,.06)}
.bj-picked-addr{margin:3px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#f2a874}
.bj-actions{display:flex;gap:10px;align-items:center}
.bj-btn{padding:9px 18px;border-radius:10px;border:1px solid rgba(232,147,90,.4);background:#e8935a;color:#1a0f08;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s ease}
.bj-btn:hover{background:#f2a874}
.bj-link{padding:0;border:none;background:none;color:#838389;font-size:12px;text-decoration:underline;cursor:pointer}
.bj-link:hover{color:#f4f4f5}
.bj-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);font-size:12px;color:#6f6f78}
@media (max-width:640px){.bj-panel{padding:20px}.bj-grid{max-height:52vh}}
\`

// prefer a routable ip, fall back to the advertised .local hostname
const addressOf = (service) => \`\${service.addresses?.[0] || service.host || ''}:\${service.port}\`

// full screen picker shown before the app, backed by the 4b-react-mdns scanner
export const DiscoveryPage = ({ onSelectService }) => {
  const { services, connected, rescan, select, selection, httpOnly, setHttpOnly } = useMdns()
  const [query, setQuery] = useState('')

  const visible = useMemo(
    () => filterServices(services, { httpOnly, query }),
    [services, httpOnly, query]
  )

  return (
    <div className="bj-root">
      <style>{styles}</style>

      <div className="bj-panel">
        <header className="bj-head">
          <div>
            <p className="bj-eyebrow">Local network</p>
            <h1 className="bj-title">Pick a server</h1>
            <p className="bj-sub">Bonjour / mDNS devices advertising on this network</p>
          </div>
          <span className="bj-status">
            <span className="bj-dot" data-live={String(connected)} />
            {connected ? \`Scanning · \${visible.length} found\` : 'Scanner offline'}
          </span>
        </header>

        <div className="bj-tools">
          <input
            className="bj-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, host or address"
          />
          <button
            type="button"
            className="bj-chip"
            data-on={String(httpOnly)}
            onClick={() => setHttpOnly(!httpOnly)}
          >
            HTTP only
          </button>
          <button type="button" className="bj-chip" onClick={rescan}>
            Rescan
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="bj-empty">
            <div className="bj-ring" />
            {connected ? 'Listening for services…' : 'Waiting for the scanner API…'}
            <p className="bj-hint">
              {connected
                ? 'Devices appear as soon as they advertise over mDNS.'
                : 'Make sure the dev server is running with mdnsPlugin().'}
            </p>
          </div>
        ) : (
          <div className="bj-grid">
            {visible.map((service) => (
              <button
                key={service.id}
                type="button"
                className="bj-card"
                data-selected={String(selection?.id === service.id)}
                onClick={() => select(service)}
              >
                <div className="bj-card-top">
                  <span className="bj-name">{service.name}</span>
                  <span className="bj-kind">{service.kind}</span>
                </div>
                <div className="bj-addr">{addressOf(service)}</div>
                <div className="bj-host">{service.host}</div>
              </button>
            ))}
          </div>
        )}

        {selection ? (
          <div className="bj-picked">
            <div>
              <strong>{selection.name}</strong>
              <p className="bj-picked-addr">{selection.url || selection.address}</p>
            </div>
            <div className="bj-actions">
              <button type="button" className="bj-btn" onClick={() => onSelectService?.(selection)}>
                Continue
              </button>
            </div>
          </div>
        ) : null}

        <footer className="bj-foot">
          <span>Your pick is remembered across reloads</span>
          <button type="button" className="bj-link" onClick={() => onSelectService?.(null)}>
            Skip for now &rarr;
          </button>
        </footer>
      </div>
    </div>
  )
}

export default DiscoveryPage
`

const homePageContent = `import { useState } from 'react'
import { useMdns } from '${mdnsPackageName}/react'
import DiscoveryPage from './DiscoveryPage.jsx'

// gates the app behind the discovery page until a server is picked or skipped
const Home = () => {
  const { selection, clear } = useMdns()
  const [entered, setEntered] = useState(false)

  if (!entered) {
    return <DiscoveryPage onSelectService={() => setEntered(true)} />
  }

  return (
    <main style={{ minHeight: '100vh', padding: '48px 32px', background: '#08080a', color: '#f4f4f5' }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Home</h1>
      <p style={{ marginTop: 12, color: '#838389', fontSize: 14 }}>
        {selection
          ? \`Connected to \${selection.name} at \${selection.address}\`
          : 'Running without a discovered server.'}
      </p>
      <button
        type="button"
        onClick={() => {
          clear()
          setEntered(false)
        }}
        style={{
          marginTop: 20,
          padding: '9px 18px',
          borderRadius: 10,
          border: '1px solid rgba(232,147,90,.4)',
          background: 'rgba(232,147,90,.12)',
          color: '#f2a874',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Change server
      </button>
    </main>
  )
}

export default Home
`

const appContent = `import Home from './pages/Home.jsx'

export default function App() {
  return <Home />
}
`

export const configureBonjourBoilerplate = async (targetPath?: string): Promise<void> => {
  try {
    const projectRoot = targetPath || process.cwd()
    const pkgJsonPath = path.join(projectRoot, 'package.json')

    if (!(await pathExists(pkgJsonPath))) {
      throw new Error('Not inside a valid project folder (package.json missing).')
    }

    section('bonjour generator', `wiring ${mdnsPackageName} mDNS service discovery`)

    let pkgJson: any = {}
    try {
      pkgJson = JSON.parse(await readFile(pkgJsonPath))
    } catch {
      /* ignore parse error */
    }

    const isInstalled = Boolean(
      pkgJson.dependencies?.[mdnsPackageName] || pkgJson.devDependencies?.[mdnsPackageName]
    )

    if (!isInstalled) {
      await runPackageInstall([mdnsPackageName], { cwd: projectRoot }, `Failed to install ${mdnsPackageName}`)
      pass(`installed ${mdnsPackageName}`)
    }

    await removeLegacyScaffold(projectRoot)

    const wired = await runPackageCodemod(projectRoot)
    if (!wired) await wireManually(projectRoot)

    const servicesDir = path.join(projectRoot, 'src', 'services')
    await ensureDir(servicesDir)
    await writeFile(path.join(servicesDir, 'bonjour.js'), bonjourServiceContent)
    pass('created src/services/bonjour.js')

    const pagesDir = path.join(projectRoot, 'src', 'pages')
    await ensureDir(pagesDir)
    await writeFile(path.join(pagesDir, 'DiscoveryPage.jsx'), discoveryPageContent)
    pass('created src/pages/DiscoveryPage.jsx')

    await writeFile(path.join(pagesDir, 'Home.jsx'), homePageContent)
    pass('created src/pages/Home.jsx')

    const appPath = (await findFirst(projectRoot, ['src/App.tsx', 'src/App.jsx'])) ||
      path.join(projectRoot, 'src', 'App.jsx')

    const existingApp = (await pathExists(appPath)) ? await readFile(appPath) : ''
    if (!existingApp.includes('pages/Home')) {
      await writeFile(appPath, appContent)
      pass(`${existingApp ? 'updated' : 'created'} ${path.basename(appPath)} to render Home`)
    }

    await typeText(
      chalk.green.bold(
        '\n✅ Bonjour discovery wired through ' + mdnsPackageName + '!\n' +
          '   Scanner API comes from mdnsPlugin(), the pick is read with getApiBaseUrl() in src/services/bonjour.js\n' +
          '   and VITE_SERVER_URL in .env stays the fallback until a server is picked.'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
