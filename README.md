<div align="center">

# Zecron CLI

### Scaffold, configure, and maintain Vite + React projects from the terminal.

![Node >=18](https://img.shields.io/badge/node-%3E%3D18-6FA8DC?style=for-the-badge)
![ESM](https://img.shields.io/badge/module-ESM-D97757?style=for-the-badge)
![Vite + React](https://img.shields.io/badge/Vite-React-00D8FF?style=for-the-badge)
![Performance Native](https://img.shields.io/badge/Engine-node:fs/promises-10B981?style=for-the-badge)
![License MIT](https://img.shields.io/badge/license-MIT-7C3AED?style=for-the-badge)

```bash
zecron
# or
react my-app
```

</div>

---

`zecron` (also accessible globally via **`react`**) is a high-performance CLI for creating, configuring, and maintaining Vite + React applications. It provides one-command component generators, real-time socket printer pages, backdrop blur loaders, automated font/image mapping, git remote workflow tools, and terminal response styling.

---

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Create An App](#create-an-app)
- [Flags](#flags)
- [Commands](#commands)
- [Component & Boilerplate Generators](#component--boilerplate-generators)
- [Performance & Engine Optimizations](#performance--engine-optimizations)
- [Git & Security Protection](#git--security-protection)
- [Package Installer](#package-installer)
- [Maintenance](#maintenance)

---

## Features

```text
Zecron CLI (zecron)
├─ Zecron Interactive Agent Welcome Hub (zecron)
├─ Fast Vite + React project creation (<1s initialization)
├─ Native node:fs/promises engine (2x-3x faster file I/O)
├─ Fast package manager auto-detection (bun -> pnpm -> yarn -> npm)
├─ Centered ASCII Zecron banner with aligned column framing
├─ Electric Cyan & Emerald Green vibrant terminal color system
├─ Automatic .env Gitignore security protection
├─ Component & Page Boilerplate Generators:
│  ├─ react set loader   (pure Tailwind CSS backdrop-blur loader)
│  ├─ react set printer  (socket print-image queue + react-to-print)
│  ├─ react set bonjour  (4b-react-mdns network discovery + themed picker)
│  ├─ Custom Log View    (logscan in-app console panel, dev-only)
│  ├─ react set form     (styled React form component with state)
│  └─ react set --font   (scan public/fonts & auto-configure @font-face)
├─ Integrated Git remote wrapper (react push --github / react push -m)
└─ Web Setup Wizard (--ui mode) with searchable choices and a live project preview
```

---

## Requirements

| Requirement | Version |
| --- | --- |
| Node.js | `>=18` |
| npm / pnpm / bun | Modern Node package manager |
| Project type | Vite + React |

---

## Installation & Quick Start

**Option 1: Instant run with `npx` (No installation needed & avoids PATH issues):**
```bash
npx zecron-cli
```

**Option 2: Install globally on your system:**
```bash
npm install -g zecron-cli
```

After global installation, these commands become available in your terminal:

| Command | Purpose |
| --- | --- |
| `zecron` | Main interactive CLI command & Agent Welcome Hub |
| `react` | Scaffold Vite + React project |
| `get` | Package alias installer inside existing React projects |

---

## Create An App

Interactive terminal mode:

```bash
react my-app
```

Create inside the current directory:

```bash
react .
```

Non-interactive flags mode:

```bash
react my-app --tailwind --axios --router --env
```

Browser setup:

```bash
anshh my-app --ui
```

Open the local URL printed in the terminal. The typing intro leads into three setup steps: dependencies, structure, and launch. Search choices, review the live file tree, and send your selections to the terminal to create the project. Each choice has original generated artwork bundled with the CLI; the interface needs no external font, icon, or animation downloads. Choose **Skip intro** or press **Escape** to enter setup immediately. Reduced-motion preferences skip the animation automatically.

---

## Flags

| Flag | Description |
| --- | --- |
| `--tailwind` | Installs `tailwindcss` and `@tailwindcss/vite`, writes `vite.config.js`, creates `src/index.css` |
| `--axios` | Installs `axios` |
| `--zod` | Installs `zod` schema validation library |
| `--socket` | Installs `socket.io-client`, scaffolds `src/services/socket.js` |
| `--toast` | Installs `ztoast`, configures `<Toaster />` in `src/App.jsx` |
| `--router` | Installs `react-router-dom` |
| `--qr` | Installs `react-qr-code` |
| `--webcam` | Installs camera dependencies and generates `Camera.jsx` and `Preview.jsx` |
| `--printer` | Installs `react-to-print`, `socket.io-client`, and scaffolds `src/pages/Printer.jsx` |
| `--icon` | Installs `react-icons` |
| `--lucide` | Installs `lucide-react` |
| `--bonjour` | Installs `4b-react-mdns`, wires `mdnsPlugin()` + `<MdnsProvider>`, scaffolds `src/pages/DiscoveryPage.jsx` |
| `--logscan` | Installs `logscan` and mounts the Custom Log View console panel at the entry point (dev only) |
| `-p, --port <number>` | Dev server port to pin in `vite.config.js` (default `5173`, validated) |
| `--env` | Creates `.env` with `VITE_SERVER_URL` and ensures `.env` is listed in `.gitignore` |
| `--ui` | Launches local browser setup wizard |

---

## Commands

Quick command reference:

```bash
react list -c
```

| Command | Purpose |
| --- | --- |
| `react <name>` | Create a new Vite + React app |
| `react <name> --ui` | Configure the app in a local browser setup wizard |
| `react .` | Create the app in the current directory |
| `react run` | Run `npm run dev -- --host 0.0.0.0` |
| `react run --port 3000` | Run dev server on a specific port |
| `react run -f` | Run dev server and open in Firefox Developer Edition |
| `react build` | Run production build (`npm run build`) with build time & status logs |
| `react build open` | Run production build and immediately launch preview server (`npm run preview`) |
| `react open` | Launch production preview server (`npm run preview`) without rebuilding |
| `react update` | Check outdated dependencies using `npm outdated` |
| `react set loader` | Generate a responsive backdrop-blur `Loader.jsx` component |
| `react set printer` | Generate `Printer.jsx` page with socket queue & `react-to-print` |
| `anshh set camera` | Install camera dependencies and generate matching camera and preview pages |
| `anshh set device` | Generate browser and device diagnostics in `src/utils/deviceInfo.js` without installing packages |
| `react set bonjour` | Wire `4b-react-mdns` discovery and generate the themed `DiscoveryPage.jsx` |
| `react set form -name -email` | Generate a styled React Form component with state & field icons |
| `react set form -bio:textarea` | Override a field's guessed input type with `key:type` |
| `react set --font` | Scan `public/fonts` and register `@font-face` rules in `src/index.css` |
| `react set api --get --post` | Generate clean Axios client in `src/services/api.js` with selected methods (`--get`, `--post`, `--del`, `--put`, `--patch`) |
| `react set logscan` | Wire the logscan in-app console panel as a dev dependency |
| `react remove logscan` | Remove logscan bootstrap code and uninstall the library |
| `get [packages...]` | Install project dependencies (like `npm i`) or install specific packages |
| `react push [--git <url>] [-m <msg>]` | Stage, commit, and push updates to Git remote repository |

---

## Component & Boilerplate Generators

### Browser & Device Diagnostics (`anshh set device`)

Run from your project directory:

```bash
anshh set device
```

Creates `src/utils/deviceInfo.js`; `anshh set --device` does the same. No packages are installed, and existing hand-edited files require confirmation before replacement. Other project files remain unchanged.

Call the helper from your application when diagnostics are needed:

```js
import { getDeviceInfo } from './utils/deviceInfo.js'

const details = await getDeviceInfo()
```

The helper is also the default export; `handleGetBrowserDetails` is a named alias for compatibility with the original function. It returns `null` outside a browser. It collects a focused troubleshooting snapshot:

| Field | Contents |
| --- | --- |
| `browser` | Browser/app name, exposed version, and `versionSource` |
| `os`, `osVersion`, `osVersionSource` | OS name and available version |
| `deviceType`, `manufacturer`, `model`, `modelSource` | Device category and recognizable manufacturer/model, when exposed |
| `screen` | Browser-reported `width`, `height`, and `devicePixelRatio` |
| `viewport` | Current `innerWidth` and `innerHeight` |
| `preferences` | `darkMode` and `dataSaver`: `true`, `false`, or `null` when unavailable |
| `secureContext`, `errors` | Context security and unavailable-field diagnostics |

Version/model sources are `client-hints`, `user-agent`, or `null`. Detailed client hints have a 2,000 ms timeout; pass `getDeviceInfo({ timeoutMs: 1000 })` to adjust it. A denied, unsupported, or failed hint lookup preserves the available snapshot. No GPU, camera/microphone, battery, location, or memory probes run. The helper makes no network requests, does not save data automatically, and does not log diagnostic values.

Console logging is off by default. Use `getDeviceInfo({ debug: true })` for collection status and unavailable-field names only. Hint failures use separate keys such as `errors['hints.platform']` and `errors['hints.highEntropy.platform']` so one failure does not replace another.

These are best-effort reported identities, including explicit markers for common mobile and in-app browsers. Unknown exact models and known frozen OS versions stay `null`; iPhone/iPad model generations and ordinary laptop models cannot reliably be inferred from browser data. Android tablets requesting desktop sites may report Linux/desktop. Browser names are not a substitute for checking a required API directly.

The iPad fallback uses a Mac-like user agent plus touch support. It remains a heuristic: phone/tablet identity in unusual Apple desktop-site modes requires physical-device verification.

Unrecognized browser and OS names use `Unknown`; an unrecognized device category uses `unknown`. Missing versions, models, manufacturers, and unavailable preferences use `null`. A `Chromium` identity means that only the Chromium family was exposed, without a recognized application brand.

Manufacturer detection infers a brand family from recognizable names and model codes. For example, `CPH` codes return `OPPO / OnePlus` because both use them; vivo codes may identify vivo-family brands. Ambiguous and unrecognized codes remain `null`. A WebView label is a user-agent heuristic, not proof of which app hosts it. As a conservative policy, iOS `18.6`/`18.7` tokens (including patch versions such as `18.6.2`) without a Safari `Version/` marker return `null` because they may be real or frozen; this can also hide a genuine older OS version. Actual exposed versions such as `26.0` remain available.

Screen and viewport sizes are CSS pixels; DPR is separate and does not prove physical panel resolution. Dimensions and preferences are read afresh on each call. Data saver is the browser-exposed preference, which may not expose the OS's Low Data Mode. Ordinary LAN HTTP can hide client hints; localhost HTTP can still be a secure context. See [UA reduction](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/User-agent_reduction), [Safari's frozen OS identifiers](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), and [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

### Camera & Photo Preview (`anshh set camera`)

Run inside an existing React 18+ app with Tailwind CSS 4 configured:

```bash
anshh set camera
```

Installs missing `react-webcam`, `clsx`, and `react-error-boundary` dependencies and generates `src/pages/Camera.jsx` and `src/components/Preview.jsx`. `anshh set --camera`, `anshh set webcam`, `get webcam`, and project creation with `--webcam` use the same setup. Existing hand-edited files require confirmation before replacement. App routes, Tailwind configuration, and other components are left alone.

Render the page from your app or route:

```jsx
import Camera from './pages/Camera.jsx'

export default function App() {
  return <Camera initialRotation={0} />
}
```

- Omit `initialRotation` for the default −90° sideways kiosk mount; use `0` for a laptop webcam. The camera and rotation selectors allow changes before capture.
- Portrait screens use the portrait frame; landscape screens use the landscape frame automatically. Set `orientation="portrait"` or `orientation="landscape"` to fix the layout.
- Capture counts down from three seconds. Set `countdownSeconds={0}` for immediate capture, or choose up to ten seconds. The countdown can be cancelled.
- Brio/external cameras are preferred. Capture requests native 4K with a 1080p minimum, then retries without the minimum if the hardware cannot provide it. The view displays the actual sensor resolution.
- Photos are center-cropped directly from the native video buffer, mirrored and rotated to match the viewfinder, and encoded once as JPEG at 0.95 quality. Review keeps the stream mounted, so Retake does not reconnect the camera. Tracks stop when the flow unmounts.
- Without a callback, **Use Photo** downloads the JPEG. To submit it, pass an async `onConfirm(image, { signal })` callback. It receives the JPEG data URL and an abort signal for your request; resolve only after a successful server response and throw on failure. Submission disables duplicate clicks and shows loading, error, retry, and success states. The signal aborts when Preview unmounts; pass it to your network request.
- Optional `onError(error)` connects camera and submission failures to your error reporting. Render failures have a recovery boundary. No photos are uploaded by the generated code itself.

Camera access requires HTTPS or localhost. Tailwind must scan these generated files; this generator does not rewrite your existing styling setup.

### 1. Backdrop Blur Loader (`react set loader`)

Generates `src/components/Loader.jsx` — every part is a prop, so you restyle it at the call site instead of editing the file:

| Prop | Default | |
| --- | --- | --- |
| `variant` | `spinner` | also `dots`, `bars`, `pulse` |
| `color` | `#1059DD` | indicator color |
| `background` / `opacity` | `#060818` / `0.8` | overlay tint |
| `size` | `56` | indicator size in px; spacing scales with it |
| `blur` | `sm` | `none`, `sm`, `md`, `lg`, `xl` |
| `overlay` | `true` | `false` renders inline instead of `absolute inset-0` |
| `text` | `Please wait...` | empty string hides it |
| `className` / `textClassName` | `''` | escape hatches |

```bash
react set loader
```

```jsx
<Loader variant="dots" color="#e8935a" size={40} blur="md" />
<Loader overlay={false} variant="pulse" text="" />
```

Colors and sizes are applied inline because Tailwind cannot compile class names built from props at runtime.

### 2. Print Queue Page (`react set printer` / `react set print`)

Generates `src/pages/Printer.jsx`, which keeps an in-memory preview queue, triggers the native print dialog with `react-to-print`, and scaffolds `src/services/socket.js` if missing. The event name, payload shape and paper size are props rather than hardcoded values:

| Prop | Default | |
| --- | --- | --- |
| `event` | `print-image` | Socket.IO event to listen on |
| `serverUrl` | `VITE_SERVER_URL` | base for relative image paths (absolute URLs pass through) |
| `getImagePath` | `(d) => d?.generatedImageName` | read the path out of your own payload shape |
| `autoPrint` | `true` | `false` shows the preview and waits for a click |
| `previewSize` / `paperSize` | A4 | `{ width, height }` |
| `objectFit` | `cover` | |
| `onPrinted` / `onError` | — | callbacks |

```bash
react set printer
```

```jsx
<Printer event="job-ready" getImagePath={(d) => d?.file}
         paperSize={{ width: '148mm', height: '210mm' }} autoPrint={false} />
```

### 3. Form Generator (`react make form` / `react set form`)

Field names are typed as bare tokens, and the input type is guessed from the name. Append `:type` when the guess is wrong:

```bash
react make form -name -email          # text, email
react make form -bio:textarea -age:number
react make form -phone                # adds to the existing form, keeps the rest
```

Supported types: `text`, `email`, `password`, `tel`, `number`, `date`, `url`, `search`, `textarea`. The resolved list is recorded in a `// zecron:fields` comment at the top of `Form.jsx`, so re-running to add one field preserves the explicit types of the others.

### 4. Dev Server Port

`react my-app` asks which port the app should run on (default `5173`), or pass `--port` to skip the prompt. The answer is written into `server.port` in `vite.config.js`, so `npm run dev` keeps using it — it isn't just applied to the first launch.

The value is rejected unless it passes every check:

| Rule | Example |
| --- | --- |
| Digits only — no letters, spaces or decimals | `abc`, `51.73`, `-1` |
| Between 1 and 65535 | `0`, `70000` |
| 1024 or higher — lower ports need root | `80`, `443`, `1023` |
| Not blocked by browsers (`ERR_UNSAFE_PORT`) | `6000`, `6667`, `2049`, `10080` |

That last rule is the one that saves real debugging time: a dev server on port 6000 starts normally but Chrome and Firefox refuse to open it, so the failure looks like a broken app rather than a bad port.

If the port is already in use the CLI warns but continues, since Vite falls back to the next free port. An invalid `--port` fails before anything is created. The browser setup wizard (`--ui`) validates against the same rules.

### 5. Safe Regeneration

Every generated file starts with a `// zecron:generated <hash>` stamp:

- Re-running with no changes reports **already up to date** and writes nothing.
- Re-running after you changed the inputs regenerates the file silently, as long as you haven't edited it.
- If the file has hand edits (or predates the stamp), the generator asks before replacing it, and keeps your version if you decline or there's no TTY.

### 6. Custom Log View (`--logscan`)

Offered as a yes/no step during `react my-app`, **defaulting to yes**, and available non-interactively as `react my-app --logscan`. It installs [`logscan`](https://www.npmjs.com/package/logscan) and mounts the panel beside your app in the entry point, so no component or route needs to change:

```jsx
import { Suspense, lazy } from 'react'

const LogScanner = import.meta.env.DEV
  ? lazy(() => import('logscan').then((module) => ({ default: module.LogScanner })))
  : null

createRoot(document.getElementById('root')).render(
  <>
    <StrictMode>
      <App />
    </StrictMode>
    {LogScanner && (
      <Suspense fallback={null}>
        <LogScanner visible />
      </Suspense>
    )}
  </>,
)
```

Keep writing `console.log()` / `warn()` / `error()` — the floating, draggable panel mirrors them inside the app, with search, severity filters and per-entry inspection. Terminal and DevTools output is unaffected.

The import is lazy and guarded by `import.meta.env.DEV`, which Vite replaces at build time, so the bundler drops the panel **and its ~930KB logo asset** from production entirely. A plain static import would have added ~45KB of JS plus that image to every production build.

This wires the **browser** half only. Streaming logs from a Node backend needs `logscan/node` installed in your server process plus a Vite proxy — see the package README.

### 7. Bonjour Discovery (`react set bonjour`)

Delegates the mDNS/DNS-SD work to the [`4b-react-mdns`](https://www.npmjs.com/package/4b-react-mdns) package instead of scaffolding a scanner by hand:

- Installs `4b-react-mdns` and runs its `4bmdns config` codemod, which adds `mdnsPlugin({ httpOnly: true })` to the Vite config and wraps the entry point in `<MdnsProvider launcher={false} httpOnly={true}>`.
- Generates `src/pages/DiscoveryPage.jsx` — a themed full-screen picker (live scan status, search, **HTTP only** toggle, rescan) built on `useMdns()`.
- Generates `src/pages/Home.jsx`, which gates the app behind the discovery page until a server is picked or skipped.
- Generates `src/services/bonjour.js` with `getApiBaseUrl()` / `getWsBaseUrl()` helpers that read the picked server and fall back to `VITE_SERVER_URL` from `.env`.
- Removes the old hand-written `server/mdnsScanner.js`, `server/vitePluginMdns.js`, and `src/services/useServiceScanner.js` scaffold and unhooks it from the Vite config.

```bash
react set bonjour
```

The pick is remembered by the package in `localStorage` and in `~/.scan-net/selection.json`, so `.env` only supplies the default until a server is chosen.

```javascript
import { getApiBaseUrl } from '../services/bonjour'

const response = await fetch(`${getApiBaseUrl()}/health`)
```

### 8. Font Asset Configurator (`react set --font`)

Scans `public/fonts/` for `.ttf`, `.woff`, `.woff2`, and `.otf` files:
- Generates `@font-face` declarations pointing to asset paths.
- Appends rules to `src/index.css` and configures Tailwind `@theme` font variables.

```bash
react set --font
```

### 9. Simplified API Service Generator (`react set api`)

Generates a lightweight Axios client in `src/services/api.js` based on selected method flags (`--get`, `--post`, `--del`, `--put`, `--patch`):

```bash
react set api --get --post --del --put
```

Outputs a clean wrapper with standard method signatures:

```javascript
import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const api = {
  get: (url, config = {}) => API.get(url, config),
  post: (url, data, config = {}) => API.post(url, data, config),
  put: (url, data, config = {}) => API.put(url, data, config),
  del: (url, config = {}) => API.delete(url, config),
  delete: (url, config = {}) => API.delete(url, config),
}

export default api
```

Usage in your components:

```javascript
// calling post with data and optional config headers
const data = await api.post('/api/userdata', { username: 'john' }, { headers: { 'X-Custom': 'value' } })
setUserData(data.data)

// calling get
const res = await api.get('/api/users')
setUsers(res.data)
```

---

## Performance & Engine Optimizations

`Zecron CLI` is optimized for instant execution and minimal I/O overhead:

1. **Native `node:fs/promises` Engine**: Replaced heavy file wrappers with native `node:fs/promises` (`mkdir`, `access`, `readFile`, `writeFile`, `rm`, `cp`) for **2x-3x faster** file operations.
2. **Fast Package Manager Auto-Detection (`detectPackageManager`)**: Automatically checks for `bun`, `pnpm`, or `yarn` on the developer's system to install dependencies in **under 1 second** (falling back to `npm install --prefer-offline`).
3. **Parallelized File Creation (`Promise.all`)**: Scaffolds template files, Vite configs, CSS styles, and imports concurrently.

---

## Git & Security Protection

- **Automated `.env` Gitignore Protection**: Whenever a project is created or `.env` is configured, `Zecron CLI` automatically generates or updates `.gitignore` to ensure `.env`, `.env.local`, and `.env.*.local` are **never accidentally pushed to Git remotes**.
- **Formatted Git Stream**: `react push` outputs colorized git status stream showing branch names (`[main 8152f98]`), insertions (`+`), deletions (`-`), and file modes in real time.
- **Live Push Progress**: the push step mirrors git's own counters while it runs, rendered as an animated bar in the same style as the install pipeline, so a large push reports what it is doing instead of sitting silent:

```text
⚡ running  Push changes (git push --progress)...
  │ ◓ Writing objects     ███████████···········  51% (314/614)
```

  The bar redraws in place and the spinner turns into a green `✓` as each phase completes. Once the push finishes, the lines git marks as final are typed out like the rest of the push output:

```text
  │ Enumerating objects: 615, done.
  │ Counting objects: 100% (615/615), done.
  │ Writing objects: 100% (614/614), 6.95 MiB | 40.44 MiB/s, done.
  │ To github.com:user/repo.git
✅ success  Push changes (git push --progress)
```

  Long file listings from a big commit are truncated to a `… N more lines` summary rather than scrolling hundreds of `create mode` entries off screen.

---

## Package Installer

Use `get` inside an existing project:

```bash
get zod
get axios
get router toast
get qr webcam printer
get --dev @types/node
```

Short aliases: `tailwind`, `axios`, `zod`, `socket`, `toast`, `icon`, `lucide`, `router`, `qr`, `webcam`, `printer`.

---

## Maintenance

Use Node.js 20 or newer to build the CLI from source, including its Tailwind compiler, and check the unit test suite:

```bash
npm run build
npm test
```

After editing the browser wizard in `templates/setup-ui/index.html`, run `npm run build:ui` to regenerate its bundled `style.css`. The normal build runs this step automatically. Keep wizard styling in Tailwind utilities; `templates/setup-ui/input.css` is the compiler entry point.

---

## License

MIT License. Designed and implemented by **Anshh**.
