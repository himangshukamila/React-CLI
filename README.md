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
│  ├─ react set --font   (scan public/fonts & auto-configure @font-face)
│  └─ react set --image  (scan public/images & generate src/utils/images.js)
├─ Integrated Git remote wrapper (react push --github / react push -m)
├─ Web Setup Wizard (--ui mode) with particle canvases & TextType intro
└─ Frontend API Watch logger (react watch)
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
| `--webcam` | Installs `react-webcam` |
| `--printer` | Installs `react-to-print`, `socket.io-client`, and scaffolds `src/pages/Printer.jsx` |
| `--icon` | Installs `react-icons` |
| `--lucide` | Installs `lucide-react` |
| `--bonjour` | Installs `4b-react-mdns`, wires `mdnsPlugin()` + `<MdnsProvider>`, scaffolds `src/pages/DiscoveryPage.jsx` |
| `--logscan` | Installs `logscan` and mounts the Custom Log View console panel at the entry point (dev only) |
| `-p, --port <number>` | Dev server port to pin in `vite.config.js` (default `5173`, validated) |
| `--env` | Creates `.env` with `VITE_SERVER_URL` and ensures `.env` is listed in `.gitignore` |
| `--watch` | Configures frontend API response logger |
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
| `react doctor` | Audit project health, setup, dependencies, and environment keys |
| `react set loader` | Generate a responsive backdrop-blur `Loader.jsx` component |
| `react set printer` | Generate `Printer.jsx` page with socket queue & `react-to-print` |
| `react set bonjour` | Wire `4b-react-mdns` discovery and generate the themed `DiscoveryPage.jsx` |
| `react set form -name -email` | Generate a styled React Form component with state & field icons |
| `react set form -bio:textarea` | Override a field's guessed input type with `key:type` |
| `react set --font` | Scan `public/fonts` and register `@font-face` rules in `src/index.css` |
| `react set --image` | Scan `public/images` and generate `src/utils/images.js` asset map |
| `react env list` | List Vite environment variables from `.env` |
| `react env add VITE_SERVER_URL <url>` | Add or update a `VITE_` environment variable |
| `react env remove VITE_SERVER_URL` | Remove a `VITE_` environment variable |
| `react make f components/ui` | Create a directory under `src/` |
| `react make components Button` | Create a file inside an existing `src` directory |
| `react asset` | Create `public/images` and `public/fonts` folders |
| `react watch` | Log frontend `fetch()` & browser Axios/XHR responses |
| `react push --github <url/msg>` | Stage, commit, and push updates to Git remote repository |

---

## Component & Boilerplate Generators

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

### 9. Image Asset Map Generator (`react set --image`)

Scans `public/images/` and outputs a camelCased asset map in `src/utils/images.js`:

```javascript
import { images } from '../utils/images'

const Banner = () => <img src={images.heroBanner} alt="Hero" />
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

Build and check unit test suite after making changes to the CLI:

```bash
npm run build
npm test
```

---

## License

MIT License. Designed and implemented by **Anshh**.


