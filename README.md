<div align="center">

# 4B React

### Scaffold and maintain Vite + React projects from the terminal.

![Node >=18](https://img.shields.io/badge/node-%3E%3D18-6FA8DC?style=for-the-badge)
![ESM](https://img.shields.io/badge/module-ESM-D97757?style=for-the-badge)
![Vite + React](https://img.shields.io/badge/Vite-React-00D8FF?style=for-the-badge)
![License MIT](https://img.shields.io/badge/license-MIT-7C3AED?style=for-the-badge)

```bash
react my-app
```

</div>

---

`react-cli` is a lightweight CLI for creating Vite + React apps with optional packages, project folders, environment files, and small development helpers.

`react` is the main public command. `anshh` is included as an optional personal alias and works the same way.

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Create An App](#create-an-app)
- [Flags](#flags)
- [Commands](#commands)
- [Package Installer](#package-installer)
- [Generated Structure](#generated-structure)
- [Security](#security)

## Features

```text
react-cli
├─ create Vite + React projects
├─ choose packages and folders interactively
├─ support flag-based non-interactive setup
├─ install common React packages with short aliases
├─ generate a Next.js-inspired App.jsx welcome screen
├─ create only selected folders
├─ manage Vite .env variables (simplified VITE_SERVER_URL)
├─ generate files and folders under src/
├─ create public asset folders (images/ & fonts/)
├─ run the Vite dev server on a persistent custom port
├─ optionally log frontend API responses
├─ run project health checks (doctor command)
└─ Web Setup Wizard:
   ├─ TextType intro screen with skip options
   ├─ GlareHover package card hover effects
   ├─ ClickSpark fullscreen particle canvas
   ├─ FuzzyText 404 error page fallback
   └─ Safe cancellation and thread shutdown
```

## Requirements

| Requirement | Version |
| --- | --- |
| Node.js | `>=18` |
| npm | modern npm |
| Project type | Vite + React |

## Installation

From the CLI folder:

```bash
chmod +x bin/index.js bin/get.js
npm install
npm link
```

After linking, these commands are available globally:

| Command | Purpose |
| --- | --- |
| `react` | Main CLI command |
| `anshh` | Optional personal alias for `react` |
| `pkg` | Install packages in an existing project |

## Create An App

Interactive mode:

```bash
react my-app
```

Create inside the current folder:

```bash
react .
```

Flags mode:

```bash
react my-app --tailwind --axios --router --env
```

Personal alias:

```bash
anshh my-app
```

The alias is optional. All documentation below uses `react`.

## Interactive Setup

When no flags are passed, the CLI opens terminal prompts.

Package choices:

```text
Tailwind CSS
Axios
Socket.IO Client
React Toastify
React Router
QR Code
Webcam
Print Helper
React Icons
Lucide React
```

Structure choices:

```text
.env
Frontend API Watch
src/components
src/pages
src/services
src/hooks
src/utils
src/store
src/lib
src/types
public/assets (images/ & fonts/)
```

Default interactive selections:

```text
Tailwind CSS
.env
src/components
src/pages
public/assets
```

## Flags

| Flag | What it does |
| --- | --- |
| `--tailwind` | Installs `tailwindcss` and `@tailwindcss/vite`, writes Vite config, creates `src/index.css` |
| `--axios` | Installs `axios` only |
| `--socket` | Installs `socket.io-client`, creates `src/services/socket.js` |
| `--toast` | Installs `react-toastify`, adds `ToastContainer` and the Toastify CSS import to `src/App.jsx` |
| `--router` | Installs `react-router-dom`, creates `src/router/index.jsx` |
| `--qr` | Installs `react-qr-code` |
| `--webcam` | Installs `react-webcam` |
| `--printer` | Installs `react-to-print` |
| `--icon` | Installs `react-icons` |
| `--lucide` | Installs `lucide-react` |
| `--env` | Creates `.env` with Vite variables |
| `--watch` | Adds optional frontend API response logging client |
| `--ui` | Opens a local browser setup wizard instead of terminal prompts |

When any flag is passed, prompts are skipped and these default folders are created:

```text
src/components
src/pages
src/hooks
src/utils
```

Package setup creates only what it needs. For example, `--axios` installs Axios only, while `--socket` creates `src/services/socket.js`.

## Commands

Quick command list:

```bash
react list -c
```

Personal alias:

```bash
anshh list -c
```

`anshh` is optional. It is only an alias for personal use; the public command is `react`.

| Command | Purpose |
| --- | --- |
| `react <name>` | Create a new Vite + React app |
| `react <name> --ui` | Configure the app in a local browser setup wizard |
| `react .` | Create the app in the current directory |
| `react <name> --tailwind --axios` | Create an app without prompts using flags |
| `react list -c` | Show every available command and its purpose |
| `react run` | Run `npm run dev -- --host 0.0.0.0` |
| `react run --port 3000` | Run the dev server on a specific port |
| `react update` | Show outdated dependencies without upgrading |
| `react doctor` | Check the current React project setup |
| `react env list` | List Vite environment variables from `.env` |
| `react env add VITE_SERVER_URL http://localhost:3000` | Add or update a `VITE_` environment variable |
| `react env remove VITE_SERVER_URL` | Remove a `VITE_` environment variable |
| `react make f components/ui` | Create a folder under `src/` |
| `react make components Button` | Create a file inside an existing `src` folder |
| `react asset` | Create public asset folders |
| `react watch` | Print frontend `fetch()` and browser Axios/XHR response logs |
| `react push --git <url>` | Initialize Git, stage, commit, and push workspace to remote repo |
| `react set --font` | Scan public/fonts and configure @font-face and Tailwind fonts in src/index.css |
| `react set --image` | Scan public/images and generate src/utils/images.js constants |
| `pkg axios` | Install a package or alias inside an existing project |
| `pkg --dev @types/node` | Install a package as a dev dependency |

### Browser Setup Wizard

```bash
react my-app --ui
```

The CLI starts a temporary local setup page and prints a URL like:

```text
http://127.0.0.1:3002/?token=...
```

Open that URL, choose packages, folders, optional frontend API watch, set custom ports, and configure whether to run the dev server after setup. 

#### Web UI Key Enhancements:
1. **Centered Typography Intro Screen:** Uses a custom vanilla `TextType` component that types out introduction commands and auto-transitions into the wizard dashboard after 2 seconds (or immediately on click).
2. **GlareHover Selection Cards:** Sleek diagonal shine gradient overlays swept across package choice cards on hover.
3. **Click Sparks Canvas Layer:** Global fullscreen canvas overlay capturing page clicks and rendering eased particle spark bursts.
4. **FuzzyText 404 Error Screen:** A double-buffered HTML canvas glitch error page fallback for invalid GET requests, linking back with active tokens.
5. **Port Customization Input:** Persistent development server port configurations parsed directly into `package.json`.
6. **Cancel Setup Trigger:** Top bar control prompting safety confirmations and locking inputs while shutting down the CLI server thread.

Safety details:

```text
server binds to 127.0.0.1 only
the URL contains a one-time setup token
browser selections are validated again inside the CLI
the setup page times out after 10 minutes
```

### Run Dev Server

```bash
react run
```

Runs:

```bash
npm run dev -- --host 0.0.0.0
```

Use a port:

```bash
react run --port 3000
```

### Dependency Update Check

```bash
react update
```

Shows outdated dependencies using `npm outdated --json`.

It does not install, upgrade, or change packages.

### Project Doctor

```bash
react doctor
```

Checks:

```text
Node version
npm version
package.json
React dependency
Vite dependency
src/main.jsx
src/App.jsx
vite.config.js
.env keys (validates VITE_SERVER_URL presence)
Tailwind setup when Tailwind is installed
```

### Env Manager

```bash
react env list
react env add VITE_SERVER_URL http://localhost:3000
react env remove VITE_SERVER_URL
```

Rules:

```text
keys must start with VITE_
keys must use uppercase letters, numbers, and underscores
values must be a single line
```

### File And Folder Generator

Create folders under `src/`:

```bash
react make f components
react make f components/ui
react make f features/auth
```

Create files inside folders that already exist:

```bash
react make components Button
react make pages Dashboard
react make hooks useAuth
react make services auth
```

Examples:

```text
react make f components/ui
└─ src/components/ui/

react make components Button
└─ src/components/Button.jsx

react make components Button ui
└─ src/components/ui/Button.jsx
```

The first argument for file creation must match a real folder under `src/`. If the folder does not exist, the command tells you to create it first.

Known folder names get better templates:

```text
component/components -> JSX component
page/pages           -> JSX page
page/pages           -> JSX page
hook/hooks           -> React hook
service/services     -> service helper
other folders        -> small JS export template
```

### Asset Folders

```bash
react asset
```

Creates public images and fonts subdirectories inside the `public/` directory. Existing folders are left untouched.

### Font Configurator

To automatically scan and register your local fonts, run:

```bash
react set --font
```

This scans `public/fonts/` recursively for `.ttf`, `.woff`, `.woff2`, and `.otf` files. For each discovered font, it will:
1. Generate `@font-face` declarations pointing to the asset URL path.
2. Resolve the font style (normal or italic) and font weight (normal, bold, variables, light, etc.) from the file name.
3. Automatically append the rules to `src/index.css`.
4. If Tailwind is configured, it adds the appropriate `@theme` variables (e.g. `--font-zen-dots`) and `@layer utilities` classes (e.g. `.font-zen-dots`).

If a font is already present in `src/index.css`, it will be skipped automatically to prevent duplicates.

### Image Asset Configurator

To automatically scan and map all your local image assets, run:

```bash
react set --image
```

This scans `public/images/` recursively for standard image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`). It will:
1. Map each asset to a clean, camelCased object key based on its relative folder and file name (e.g. `brandingLogoDark` for `public/images/branding/logo-dark.png`).
2. Generate a single consolidated mapping object exported as `images` inside `src/utils/images.js`.

In your React code, you can then import the object and enjoy auto-completed image asset references:

```javascript
import { images } from '../utils/images'

const App = () => {
  return <img src={images.brandingLogoDark} alt="Logo" />
}
```

### Frontend API Watch

This feature is optional. Add it during project creation:

```bash
react my-app --watch
```

or select `Frontend API Watch` in the interactive structure prompt.

Then run:

```bash
react watch
```

In another terminal:

```bash
react run
```

When the browser makes a `fetch()` or browser Axios/XHR request, the terminal prints:

```text
11:42:10 GET 200 134ms
url      http://localhost:3000/api/users
data
  [
    {
      "id": 1,
      "name": "Himangshu"
    }
  ]
```

Notes:

- Watches browser `fetch()` and XHR only.
- Does not watch Node/server logs.
- Works with any API IP or port the browser can access.
- CORS-blocked responses cannot expose the response body.
- Sensitive keys are redacted.
- Large response bodies are truncated.
- Logs are sent only to `127.0.0.1`.

### Git Push Wrapper

To quickly publish your workspace, run:

```bash
react push --git https://git.4brains.in/himangshu.kamila/test-repo.git
```

This runs the following steps sequentially in the current directory and prints execution status for each:
1. `git init` (Initializes local repository)
2. `git checkout -b main` (Creates and switches to main branch)
3. `git add .` (Stages all project files)
4. `git commit -m "first commit"` (Creates the initial commit)
5. `git remote add origin <url>` (Links remote origin)
6. `git push -u origin main` (Pushes and tracks main branch on remote)

If any command fails, the runner reports the failure immediately, outputs detailed error messages, and halts execution to allow troubleshooting.

#### Subsequent Updates

For subsequent update pushes once Git is already configured, you can omit the remote URL and provide a custom commit message:

```bash
react push -m "feat: added camera views"
```

This runs:
1. `git add .` (Stages modified/new files)
2. `git commit -m "feat: added camera views"` (Commits changes)
3. `git push -u origin main` (Pushes branch updates to remote main)

If there are no changes to commit, it will output a warning skip tag (`⚠ skipped`) and safely proceed to push.


## Package Installer

Use `pkg` inside an existing project:

```bash
pkg axios
pkg router toast
pkg qr webcam printer
pkg --dev @types/node
```

Aliases:

| Alias | Installs |
| --- | --- |
| `tailwind` | `tailwindcss` |
| `axios` | `axios` |
| `socket` | `socket.io-client` |
| `toast` | `react-toastify` |
| `icon` | `react-icons` |
| `lucide` | `lucide-react` |
| `router` | `react-router-dom` |
| `qr` | `react-qr-code` |
| `webcam` | `react-webcam` |
| `printer` | `react-to-print` |

Unknown valid npm package names pass through as-is.

## Generated Structure

Base files:

```text
src/App.jsx
src/main.jsx
```

When Tailwind is selected:

```text
src/index.css
vite.config.js
```

When `.env` is selected:

```text
.env
```

with:

```text
VITE_SERVER_URL=http://localhost:3000
```

When Frontend API Watch is selected:

```text
src/react-setup-watch/client.js
```

When Socket.io is selected:

```text
src/services/socket.js
```

Scaffolds a websocket connection client helper using robust, diagnostic-ready listeners:
- Monitors `connect` and log connection socket ID.
- Monitors `disconnect` and reports specific termination reasons.
- Monitors `connect_error` to catch connection issues.
- Monitors `reconnect` & `reconnect_attempt` to output reconnection details.

## Tailwind Setup

Tailwind follows the Vite plugin flow:

```bash
npm install tailwindcss @tailwindcss/vite
```

Generated `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

Generated `src/index.css`:

```css
## Web Setup Wizard Quick File Creator

The browser-based wizard (`--ui` mode) features a **Quick File Creator** panel in the Launch section. This simplifies scaffolding by letting you add custom pages, components, hooks, or utility files in memory before building the project:
- **Dynamic Folders Dropdown:** Auto-populates only from the active directory structures checked in the wizard (e.g. `components`, `pages`, `hooks`).
- **Extensions:** Supports `.js` (ES Modules) and `.jsx` (React Components).
- **Live Memory Map Sync:** Dynamically projects created files into the right-hand file tree preview. It preserves custom files across folder toggles and auto-expands the folder upon creation.
- **Tailored Boilerplates:**
  - Standard files are scaffolded with clean default function templates.
  - **`Wrapper.jsx`** (in `src/components/`) scaffolds a styled layout component with standard children props.
  - **`Loader.jsx`** (in `src/components/`) scaffolds a responsive fullscreen loading spinner using standard Tailwind CSS utility classes and backdrop-blur styling.

## Custom Brand Favicon & Dynamic Page Title

- **Custom Favicon:** The default Vite SVG favicon is replaced by a custom 4B React CLI vector logo, written to both `public/favicon.svg` and `public/vite.svg`.
- **Dynamic Title & Link Ref:** On scaffolding, the project's root `index.html` is parsed using regular expressions to swap the default Vite favicon reference for `/favicon.svg` and dynamically set the page `<title>` tag to the capitalized project folder name.

## Holographic Dashboard Welcome Screen (App.jsx)

The default scaffolded welcome page (`src/App.jsx`) is configured with a high-end, responsive holographic dashboard layout:
- **Holographic Orbiting Rings:** Concentric dashed orbit rings (`.orbit-ring-outer` and `.orbit-ring-inner`) rotate in opposite directions around the brand logo using linear keyframe spin loops.
- **Floating Logo Glow:** The brand SVG floats vertically with a smooth yoyo transition (`floatAndGlow` animation) and breathes a neon cyan drop-shadow.
- **Metallic Shimmering Title (`textShine`):** The "4B React" brand title pans horizontally with linear-gradient text clips to simulate a shining chrome reflection.
- **Glassmorphic Hover Shine Cards:** Resource cards feature reflection sweeps on hover (using CSS skewed pseudo-elements), neon cyan border spotlights, and horizontal arrow slide transformations.

## Share

Clone or copy the CLI folder, then run:

```bash
npm install
npm link
```

Then create an app:

```bash
react my-app
```

## Uninstall

```bash
npm unlink -g react-setup-cli
```

This removes the global CLI link. It does not delete apps created with the CLI.

## Maintenance

| Area | File |
| --- | --- |
| Main CLI behavior | `bin/index.js` |
| Package installer | `bin/get.js` |
| Shared helpers | `lib/shared.js` |
| Base templates | `templates/base/src/` |
| Tailwind template | `templates/tailwind/src/index.css` |
| Browser setup wizard | `templates/setup-ui/index.html` |

Check syntax after edits:

```bash
node --check bin/index.js
node --check bin/get.js
node --check lib/shared.js
node --check templates/base/src/react-setup-watch/client.js
```

## Security

- Commands use `execa(command, argsArray)`.
- No `shell: true`.
- No `child_process`, `exec`, or `execSync`.
- Project names and package names are validated.
- Path traversal is rejected.
- Existing non-empty folders are never overwritten.
- `react watch` logs only to `127.0.0.1` during development.
