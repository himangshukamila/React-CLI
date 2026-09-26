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
  generateSocketFileContent,
} from '../shared.js'
import { writeGenerated } from './safeWrite.js'

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

  if (removed > 0) pass('removed the previous hand written mdns scaffold')
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

const adminTriggerImport = `import BonjourAdminTrigger from './components/BonjourAdminTrigger.jsx'\n`
const mdnsReactImport = new RegExp(`^import[^\\n]*['"]${mdnsPackageName}/react['"][^\\n]*\\n`, 'm')

/**
 * Render <BonjourAdminTrigger /> once, inside <MdnsProvider> in the entry file.
 * The trigger is app-wide, so it belongs at the root: on a page it only mounts
 * when the app happens to render that page — and the base template's App.jsx
 * never renders Home, which left the admin modal unreachable.
 */
export const mountAdminTrigger = (
  entry: string
): { source: string; status: 'added' | 'present' | 'no-provider' } => {
  if (entry.includes('BonjourAdminTrigger')) return { source: entry, status: 'present' }

  const closeAt = entry.lastIndexOf('</MdnsProvider>')
  if (closeAt === -1) return { source: entry, status: 'no-provider' }

  const lineStart = entry.lastIndexOf('\n', closeAt) + 1
  const leading = entry.slice(lineStart, closeAt)
  let next = leading.trim() === ''
    ? `${entry.slice(0, lineStart)}${leading}  <BonjourAdminTrigger />\n${entry.slice(lineStart)}`
    : `${entry.slice(0, closeAt)}<BonjourAdminTrigger />${entry.slice(closeAt)}`

  const anchor = next.match(mdnsReactImport)
  if (anchor && anchor.index !== undefined) {
    const at = anchor.index + anchor[0].length
    next = next.slice(0, at) + adminTriggerImport + next.slice(at)
  } else {
    next = adminTriggerImport + next
  }

  return { source: next, status: 'added' }
}

const bonjourServiceContent = `import { getSelectedAddress, RECORD_KEY } from '${mdnsPackageName}/react'

// fallback url from environment variable
const envUrl = (import.meta.env.VITE_SERVER_URL || '').trim().replace(/\\/+$/, '')

const TESTING_KEY = 'app_is_testing'
const MANUAL_KEY = 'app_manual_server_ip'
// earlier builds kept the manual override under '4b_mdns_ip', which differs
// from 4b-react-mdns's own '4b_mDNS_ip' only by letter case
const LEGACY_MANUAL_KEY = '4b_mdns_ip'

const hasWindow = () => typeof window !== 'undefined'

// storage throws in locked-down or sandboxed browsers (kiosk modes, private
// windows), and a settings read must never take the app down with it
function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: the setting just won't persist */
  }
}

// move a manual ip saved under the legacy key so deployed kiosks keep it
function migrateLegacyManualIp() {
  const legacy = readStorage(LEGACY_MANUAL_KEY)
  if (legacy === null) return
  if (readStorage(MANUAL_KEY) === null) writeStorage(MANUAL_KEY, legacy)
  writeStorage(LEGACY_MANUAL_KEY, null)
}

const stripScheme = (value) => value.replace(/^https?:\\/\\//i, '').replace(/\\/+$/, '')

// the manual entry as saved, including an explicit https:// if one was typed
function readManualEntry() {
  migrateLegacyManualIp()
  return (readStorage(MANUAL_KEY) || '').trim()
}

// check if test mode is enabled (test until explicitly switched to live)
export function getIsTestingMode() {
  if (!hasWindow()) return true
  const stored = readStorage(TESTING_KEY)
  return stored === null ? true : stored === 'true'
}

// set testing mode in local storage
export function setIsTestingMode(isTesting) {
  if (!hasWindow()) return
  writeStorage(TESTING_KEY, String(Boolean(isTesting)))
}

// accepts "192.168.1.100", "kiosk.local:3000", "[fe80::1]:3000", with an
// optional http(s):// prefix; returns an error message, or '' when valid
export function validateServerAddress(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'Enter a server address'

  const address = stripScheme(raw)
  if (/[\\s/?#]/.test(address)) return 'Use host or host:port only, without paths or spaces'

  const match = address.match(/^(\\[[0-9a-f:.]+\\]|[a-z0-9.-]+)(?::(\\d{1,5}))?$/i)
  if (!match) return 'Use an address like 192.168.1.100:3000'

  const [, host, port] = match
  if (/^[\\d.]+$/.test(host)) {
    const octets = host.split('.')
    if (octets.length !== 4 || octets.some((octet) => octet === '' || Number(octet) > 255)) {
      return 'That is not a valid IP address'
    }
  }
  if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) {
    return 'Port must be between 1 and 65535'
  }
  return ''
}

// get manual server ip if configured (host:port, without a scheme)
export function getManualServerIp() {
  if (!hasWindow()) return ''
  return stripScheme(readManualEntry())
}

// set manual server ip fallback, keeping an explicit https:// scheme
export function setManualServerIp(ip) {
  if (!hasWindow()) return
  const cleaned = String(ip || '').trim().replace(/\\/+$/, '')
  writeStorage(MANUAL_KEY, cleaned || null)
}

// clear manual server ip
export function clearManualServerIp() {
  if (!hasWindow()) return
  writeStorage(MANUAL_KEY, null)
  writeStorage(LEGACY_MANUAL_KEY, null)
}

// the record 4b-react-mdns saves for the discovered pick; RECORD_KEY is its public key
function readDiscoveredRecord() {
  const raw = readStorage(RECORD_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// get currently selected server address from manual input or mdns discovery
export function getSelectedServer() {
  if (!hasWindow()) return ''
  return getManualServerIp() || getSelectedAddress() || ''
}

// resolve target api server url cleanly formatted with protocol; an https
// manual entry or an _https._tcp service keeps https instead of being downgraded
export function resolveServerUrl(fallbackUrl) {
  if (hasWindow()) {
    const manual = readManualEntry()
    if (manual) {
      const scheme = /^https:\\/\\//i.test(manual) ? 'https' : 'http'
      return \`\${scheme}://\${stripScheme(manual)}\`
    }

    const discovered = getSelectedAddress()
    if (discovered) {
      const scheme = readDiscoveredRecord()?.type === 'https' ? 'https' : 'http'
      return \`\${scheme}://\${stripScheme(discovered)}\`
    }
  }

  return (fallbackUrl || envUrl || '').trim().replace(/\\/+$/, '')
}

// http base url for api calls
export function getApiBaseUrl(fallbackUrl) {
  return resolveServerUrl(fallbackUrl)
}

// websocket base url derived from the active address
export function getWsBaseUrl(fallbackUrl) {
  const resolved = resolveServerUrl(fallbackUrl)
  if (resolved) {
    return resolved.replace(/^http/i, 'ws')
  }
  return ''
}

// aliases for backwards compatibility
export const getServerIp = getSelectedServer
export const getEnvServerIp = () => envUrl
`

const discoveryModalContent = `import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { filterServices, useMdns } from '${mdnsPackageName}/react'
import {
  getIsTestingMode,
  setIsTestingMode,
  getManualServerIp,
  setManualServerIp,
  clearManualServerIp,
  validateServerAddress,
} from '../services/bonjour.js'

const styles = \`
.bj-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,4,6,.78);backdrop-filter:blur(10px);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f4f4f5}
.bj-panel{position:relative;width:100%;max-width:760px;max-height:90vh;overflow-y:auto;padding:26px;border-radius:18px;border:1px solid rgba(232,147,90,.16);background:rgba(12,12,15,.96);box-shadow:0 24px 64px rgba(0,0,0,.7)}
.bj-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.08)}
.bj-eyebrow{margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#e8935a;font-weight:600}
.bj-title{margin:0;font-size:20px;font-weight:600}
.bj-sub{margin:4px 0 0;font-size:13px;color:#8e8e96}
.bj-close{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#b4b4bb;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.bj-close:hover{background:rgba(255,255,255,.1);color:#fff}
.bj-section-title{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#b4b4bb;margin:18px 0 10px}
.bj-mode-row{display:flex;gap:8px;background:rgba(255,255,255,.03);padding:4px;border-radius:12px;border:1px solid rgba(255,255,255,.07)}
.bj-mode-btn{flex:1;padding:8px 14px;border-radius:8px;border:none;background:transparent;color:#8e8e96;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
.bj-mode-btn[data-active="true"]{background:rgba(232,147,90,.14);color:#f2a874;font-weight:600;box-shadow:inset 0 0 0 1px rgba(232,147,90,.3)}
.bj-tools{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 12px}
.bj-search{flex:1;min-width:180px;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#f4f4f5;font-size:13px;outline:none}
.bj-search:focus{border-color:rgba(232,147,90,.4)}
.bj-chip{padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#b4b4bb;font-size:12px;cursor:pointer}
.bj-chip[data-on="true"]{border-color:rgba(232,147,90,.4);background:rgba(232,147,90,.12);color:#f2a874}
.bj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;max-height:28vh;overflow-y:auto;padding:2px}
.bj-card{padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);color:inherit;font:inherit;text-align:left;cursor:pointer;transition:all .15s}
.bj-card:hover{border-color:rgba(232,147,90,.35);background:rgba(232,147,90,.05)}
.bj-card[data-selected="true"]{border-color:rgba(232,147,90,.5);background:rgba(232,147,90,.1)}
.bj-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.bj-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bj-kind{padding:2px 6px;border-radius:999px;background:rgba(232,147,90,.12);color:#e8935a;font-size:10px;text-transform:uppercase}
.bj-addr{margin-top:6px;font-family:monospace;font-size:11px;color:#b4b4bb}
.bj-empty{padding:28px 0;text-align:center;color:#838389;font-size:13px}
.bj-manual-row{display:flex;gap:8px;margin-top:10px}
.bj-manual-input{flex:1;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#f4f4f5;font-size:13px;font-family:monospace;outline:none}
.bj-manual-input:focus{border-color:rgba(232,147,90,.4)}
.bj-btn{padding:9px 16px;border-radius:10px;border:1px solid rgba(232,147,90,.4);background:#e8935a;color:#180f08;font-size:13px;font-weight:600;cursor:pointer}
.bj-btn:hover{background:#f2a874}
.bj-btn-sec{padding:9px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#f4f4f5;font-size:13px;cursor:pointer}
.bj-active-banner{margin-top:14px;padding:10px 14px;border-radius:10px;border:1px solid rgba(232,147,90,.25);background:rgba(232,147,90,.07);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}
.bj-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);font-size:12px;color:#6f6f78}
.bj-link{background:none;border:none;color:#8e8e96;cursor:pointer;text-decoration:underline;padding:0;font-size:12px}
.bj-link:hover{color:#fff}
.bj-error{margin:6px 0 0;font-size:12px;color:#fca5a5}
\`

// Rank addresses the same way 4b-react-mdns does when it saves a pick, so the
// card shows the address select() will actually store: routable IPv4, IPv6,
// Docker-range 172.16-31.x, link-local, then anything else. addresses[0] can
// be a Docker bridge that nothing but the host itself can reach.
const isIPv4 = (value) => {
  const parts = value.split('.')
  return parts.length === 4 && parts.every((part) => /^\\d{1,3}$/.test(part) && Number(part) <= 255)
}

const rankAddress = (value) => {
  if (/^169\\.254\\./.test(value) || value.startsWith('fe80:')) return 3
  if (/^172\\.(1[6-9]|2\\d|3[01])\\./.test(value)) return 2
  if (isIPv4(value)) return 0
  if (value.includes(':')) return 1
  return 4
}

const addressOf = (service) => {
  const best = [...(service.addresses || [])].sort((a, b) => rankAddress(a) - rankAddress(b))[0] || service.host
  if (!best) return ''
  return \`\${best.includes(':') ? \`[\${best}]\` : best}:\${service.port}\`
}

export const DiscoveryModal = ({ isOpen, onClose, onSelectService }) => {
  const [mounted, setMounted] = useState(false)
  const [isTesting, setIsTesting] = useState(true)
  const [manualIp, setManualIp] = useState('')
  const [activeManual, setActiveManual] = useState('')
  const [query, setQuery] = useState('')
  const [manualError, setManualError] = useState('')

  const { services, connected, rescan, select, selection, httpOnly, setHttpOnly } = useMdns()

  useEffect(() => {
    setMounted(true)
    setIsTesting(getIsTestingMode())
    setActiveManual(getManualServerIp())
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleModeChange = (mode) => {
    setIsTesting(mode)
    setIsTestingMode(mode)
  }

  const handleConnectManual = () => {
    // a typo here would point every request the kiosk makes at nothing
    const error = validateServerAddress(manualIp)
    setManualError(error)
    if (error) return
    setManualServerIp(manualIp)
    setActiveManual(getManualServerIp())
    setManualIp('')
  }

  const handleClearManual = () => {
    clearManualServerIp()
    setActiveManual('')
  }

  // the manual override outranks discovery, so picking a server here has to
  // clear it — otherwise the card highlights while traffic keeps going to the
  // manual address
  const handleSelectDiscovered = (service) => {
    select(service)
    clearManualServerIp()
    setActiveManual('')
    onSelectService?.(service)
  }

  const visible = useMemo(
    () => filterServices(services, { httpOnly, query }),
    [services, httpOnly, query]
  )

  if (!mounted || !isOpen || typeof document === 'undefined') {
    return null
  }

  const modalContent = (
    <div
      className="bj-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <style>{styles}</style>
      <div className="bj-panel" role="dialog" aria-modal="true">
        <header className="bj-head">
          <div>
            <p className="bj-eyebrow">Kiosk Administration</p>
            <h2 className="bj-title">Bonjour & Network Settings</h2>
            <p className="bj-sub">Configure service discovery, API mode, and server endpoints</p>
          </div>
          <button type="button" className="bj-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div>
          <p className="bj-section-title">API Environment Mode</p>
          <div className="bj-mode-row">
            <button
              type="button"
              className="bj-mode-btn"
              data-active={String(isTesting)}
              onClick={() => handleModeChange(true)}
            >
              Test Mode
            </button>
            <button
              type="button"
              className="bj-mode-btn"
              data-active={String(!isTesting)}
              onClick={() => handleModeChange(false)}
            >
              Live Mode
            </button>
          </div>
        </div>

        <div>
          <p className="bj-section-title">Discovered Bonjour / mDNS Servers</p>
          <div className="bj-tools">
            <input
              className="bj-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, host, or address"
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
              {connected ? 'Listening for mDNS devices on local subnet…' : 'Connecting to scanner API…'}
            </div>
          ) : (
            <div className="bj-grid">
              {visible.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className="bj-card"
                  data-selected={String(selection?.id === service.id)}
                  onClick={() => handleSelectDiscovered(service)}
                >
                  <div className="bj-card-top">
                    <span className="bj-name">{service.name}</span>
                    <span className="bj-kind">{service.kind}</span>
                  </div>
                  <div className="bj-addr">{addressOf(service)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="bj-section-title">Manual IP Connection Fallback</p>
          <div className="bj-manual-row">
            <input
              className="bj-manual-input"
              value={manualIp}
              onChange={(e) => {
                setManualIp(e.target.value)
                if (manualError) setManualError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConnectManual()
              }}
              placeholder="e.g. 192.168.1.100:3000"
              aria-invalid={Boolean(manualError)}
            />
            <button type="button" className="bj-btn" onClick={handleConnectManual}>
              Connect IP
            </button>
          </div>
          {manualError ? <p className="bj-error" role="alert">{manualError}</p> : null}
        </div>

        {activeManual ? (
          <div className="bj-active-banner">
            <div>
              <strong>Manual IP Override Active:</strong>{' '}
              <span style={{ fontFamily: 'monospace', color: '#f2a874' }}>{activeManual}</span>
            </div>
            <button type="button" className="bj-btn-sec" onClick={handleClearManual}>
              Clear
            </button>
          </div>
        ) : null}

        <footer className="bj-foot">
          <span>Settings persist automatically across kiosk reboots</span>
          <button type="button" className="bj-link" onClick={onClose}>
            Skip for now &rarr;
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default DiscoveryModal
`

const bonjourAdminTriggerContent = `import { useEffect, useRef, useState } from 'react'
import DiscoveryModal from './DiscoveryModal.jsx'

// size of the hidden top-right hot corner, and how close together two taps must land
const HOTSPOT_SIZE = 120
const DOUBLE_TAP_MS = 400

// one trigger owns the gesture, even if a page renders another copy
let owner = null

// Hidden kiosk admin trigger: double-tap or double-click the top-right corner.
// It listens on the window instead of covering the corner with an element, so
// the app's own buttons in that corner keep receiving taps, and it counts
// pointerdown events because touch screens don't reliably fire dblclick.
export const BonjourAdminTrigger = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [active, setActive] = useState(false)
  const isOpenRef = useRef(false)
  const lastTapRef = useRef(-Infinity)

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    if (owner) return undefined
    const token = {}
    owner = token
    setActive(true)

    const handlePointerDown = (event) => {
      // taps while the modal is open (on its close button, say) don't count
      if (!event.isPrimary || isOpenRef.current) return

      const inCorner =
        event.clientX >= window.innerWidth - HOTSPOT_SIZE && event.clientY <= HOTSPOT_SIZE
      if (!inCorner) {
        lastTapRef.current = -Infinity
        return
      }

      if (event.timeStamp - lastTapRef.current <= DOUBLE_TAP_MS) {
        lastTapRef.current = -Infinity
        setIsOpen(true)
      } else {
        lastTapRef.current = event.timeStamp
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      if (owner === token) owner = null
    }
  }, [])

  if (!active) return null
  return <DiscoveryModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
}

export default BonjourAdminTrigger
`

const discoveryPageContent = `import DiscoveryModal from '../components/DiscoveryModal.jsx'

// discovery shown before entering the app; closing, Escape and "Skip for now"
// report null, the same contract the page had before it became a modal
export const DiscoveryPage = ({ onSelectService }) => {
  return (
    <DiscoveryModal
      isOpen
      onSelectService={onSelectService}
      onClose={() => onSelectService?.(null)}
    />
  )
}

export default DiscoveryPage
`

// the admin trigger is mounted once at the root in main.jsx, so pages don't render it
const homePageContent = `const Home = () => {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 32px', background: '#08080a', color: '#f4f4f5' }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Home</h1>
      <p style={{ marginTop: 12, color: '#838389', fontSize: 14 }}>
        Kiosk application is running. Double-tap or double-click the top-right corner to open Bonjour discovery settings.
      </p>
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
    const componentsDir = path.join(projectRoot, 'src', 'components')
    const pagesDir = path.join(projectRoot, 'src', 'pages')
    await ensureDir(servicesDir)
    await ensureDir(componentsDir)
    await ensureDir(pagesDir)

    const triggerPath = path.join(componentsDir, 'BonjourAdminTrigger.jsx')
    const generatedFiles: [string, string][] = [
      [path.join(servicesDir, 'bonjour.js'), bonjourServiceContent],
      [path.join(componentsDir, 'DiscoveryModal.jsx'), discoveryModalContent],
      [triggerPath, bonjourAdminTriggerContent],
      [path.join(pagesDir, 'DiscoveryPage.jsx'), discoveryPageContent],
    ]

    // these are the files people customise, so a re-run asks before replacing edits
    for (const [filePath, content] of generatedFiles) {
      if (await writeGenerated(filePath, content, { projectRoot })) {
        pass(`created ${path.relative(projectRoot, filePath)}`)
      }
    }

    // synchronize existing socket.js with bonjour if present
    const socketPath = path.join(servicesDir, 'socket.js')
    if (await pathExists(socketPath)) {
      const socketCode = await readFile(socketPath)
      if (!socketCode.includes('getWsBaseUrl')) {
        await writeFile(socketPath, generateSocketFileContent({ bonjour: true }))
        pass('synchronized src/services/socket.js with bonjour')
      }
    }

    // synchronize existing api.js with bonjour if present
    const apiPath = path.join(servicesDir, 'api.js')
    if (await pathExists(apiPath)) {
      let apiCode = await readFile(apiPath)
      if (!apiCode.includes('getApiBaseUrl')) {
        if (!apiCode.includes("from './bonjour.js'") && !apiCode.includes('from "./bonjour.js"')) {
          apiCode = `import { getApiBaseUrl } from './bonjour.js'\n` + apiCode
        }
        const bonjourInterceptor = `\n// dynamically use updated bonjour server ip on each request\nAPI.interceptors.request.use((config) => {\n  const dynamicUrl = getApiBaseUrl()\n  if (dynamicUrl) {\n    config.baseURL = dynamicUrl\n  }\n  return config\n})\n`
        if (apiCode.includes('export const api = {')) {
          apiCode = apiCode.replace('export const api = {', `${bonjourInterceptor}export const api = {`)
        } else if (apiCode.includes('export default api')) {
          apiCode = apiCode.replace('export default api', `${bonjourInterceptor}export default api`)
        }
        await writeFile(apiPath, apiCode)
        pass('synchronized src/services/api.js with bonjour')
      }
    }

    const homePath = path.join(pagesDir, 'Home.jsx')
    const existingHome = (await pathExists(homePath)) ? await readFile(homePath) : ''
    if (!existingHome) {
      await writeFile(homePath, homePageContent)
      pass('created src/pages/Home.jsx')
    } else {
      pass('preserved existing src/pages/Home.jsx without overwriting')
    }

    const appPath = (await findFirst(projectRoot, ['src/App.tsx', 'src/App.jsx'])) ||
      path.join(projectRoot, 'src', 'App.jsx')

    const existingApp = (await pathExists(appPath)) ? await readFile(appPath) : ''
    if (!existingApp) {
      await writeFile(appPath, appContent)
      pass(`created ${path.basename(appPath)} to render Home`)
    }

    // mount the admin trigger once at the root, independent of App/Home
    const entryPath = await findFirst(projectRoot, entryPointNames)
    const triggerSource = await readFile(triggerPath)

    if (!triggerSource.includes('pointerdown')) {
      // a kept, older trigger draws its own overlay; mounting it at the root as
      // well would stack two of them in the same corner
      warn('kept your BonjourAdminTrigger.jsx', 'render it once inside <MdnsProvider> yourself')
    } else if (!entryPath) {
      warn('no entry point found', 'render <BonjourAdminTrigger /> inside <MdnsProvider> yourself')
    } else {
      const entryName = path.basename(entryPath)
      const { source, status } = mountAdminTrigger(await readFile(entryPath))
      if (status === 'added') {
        await writeFile(entryPath, source)
        pass(`mounted <BonjourAdminTrigger /> in ${entryName}`)
      } else if (status === 'no-provider') {
        warn(`no <MdnsProvider> in ${entryName}`, 'render <BonjourAdminTrigger /> inside it yourself')
      }
    }

    await typeText(
      chalk.green.bold(
        '\n✅ Bonjour discovery wired through ' + mdnsPackageName + '!\n' +
          '   Double-tap or double-click the top-right corner to open the settings modal.\n' +
          '   Server resolution lives in resolveServerUrl() in src/services/bonjour.js,\n' +
          '   with test vs live mode persisted in localStorage (app_is_testing).'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
