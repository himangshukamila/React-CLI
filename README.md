<div align="center">

# 4B React (Spark CLI)

### Scaffold, configure, and maintain Vite + React projects from the terminal.

![Node >=18](https://img.shields.io/badge/node-%3E%3D18-6FA8DC?style=for-the-badge)
![ESM](https://img.shields.io/badge/module-ESM-D97757?style=for-the-badge)
![Vite + React](https://img.shields.io/badge/Vite-React-00D8FF?style=for-the-badge)
![Performance Native](https://img.shields.io/badge/Engine-node:fs/promises-10B981?style=for-the-badge)
![License MIT](https://img.shields.io/badge/license-MIT-7C3AED?style=for-the-badge)

```bash
react my-app
# or
anshh my-app
```

</div>

---

`react-cli` (also accessible globally via the **`anshh`** personal alias) is a high-performance CLI for creating, configuring, and maintaining Vite + React applications. It provides one-command component generators, real-time socket printer pages, backdrop blur loaders, automated font/image mapping, git remote workflow tools, and terminal response styling.

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
Spark CLI (react-cli)
├─ Fast Vite + React project creation (<1s initialization)
├─ Native node:fs/promises engine (2x-3x faster file I/O)
├─ Fast package manager auto-detection (bun -> pnpm -> yarn -> npm)
├─ Centered ASCII Spark banner with aligned column framing
├─ Electric Cyan & Emerald Green vibrant terminal color system
├─ Automatic .env Gitignore security protection
├─ Component & Page Boilerplate Generators:
│  ├─ react set loader   (pure Tailwind CSS backdrop-blur loader)
│  ├─ react set printer  (socket print-image queue + react-to-print)
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

## Installation

From the CLI project directory:

```bash
chmod +x bin/index.js bin/get.js
npm install
npm link
```

After linking, these commands are available globally:

| Command | Purpose |
| --- | --- |
| `react` | Main public CLI command |
| `anshh` | Personal alias for `react` |
| `pkg` | Package alias installer inside existing React projects |

---

## Create An App

Interactive terminal mode:

```bash
react my-app
# or
anshh my-app
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
| `--socket` | Installs `socket.io-client`, scaffolds `src/services/socket.js` |
| `--toast` | Installs `react-hot-toast`, configures `<Toaster />` in `src/App.jsx` |
| `--router` | Installs `react-router-dom` |
| `--qr` | Installs `react-qr-code` |
| `--webcam` | Installs `react-webcam` |
| `--printer` | Installs `react-to-print`, `socket.io-client`, and scaffolds `src/pages/Printer.jsx` |
| `--icon` | Installs `react-icons` |
| `--lucide` | Installs `lucide-react` |
| `--env` | Creates `.env` with `VITE_SERVER_URL` and ensures `.env` is listed in `.gitignore` |
| `--watch` | Configures frontend API response logger |
| `--ui` | Launches local browser setup wizard |

---

## Commands

Quick command reference:

```bash
react list -c
# or
anshh list -c
```

| Command | Purpose |
| --- | --- |
| `react <name>` | Create a new Vite + React app |
| `react <name> --ui` | Configure the app in a local browser setup wizard |
| `react .` | Create the app in the current directory |
| `react run` | Run `npm run dev -- --host 0.0.0.0` |
| `react run --port 3000` | Run dev server on a specific port |
| `react update` | Check outdated dependencies using `npm outdated` |
| `react doctor` | Audit project health, setup, dependencies, and environment keys |
| `react set loader` | Generate a responsive backdrop-blur `Loader.jsx` component |
| `react set printer` | Generate `Printer.jsx` page with socket queue & `react-to-print` |
| `react set form -name -email` | Generate a styled React Form component with state & field icons |
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

Generates `src/components/Loader.jsx`:
- Pure Tailwind CSS overlay (`absolute inset-0 z-30 bg-[#060818]/80 backdrop-blur-sm`).
- Built-in spinning indicator with custom `text` prop support (defaults to `'Please wait...'`).
- Pure CSS/HTML implementation (zero third-party React dispatcher dependencies).

```bash
anshh set loader
```

### 2. Print Queue Page (`react set printer` / `react set print`)

Generates `src/pages/Printer.jsx`:
- Listens to Socket.IO `"print-image"` events from `VITE_SERVER_URL`.
- Maintains an in-memory print image preview queue.
- Automatically triggers native browser print dialogs using `react-to-print` (`useReactToPrint`).
- Auto-scaffolds `src/services/socket.js` connection client if missing.

```bash
anshh set printer
```

### 3. Font Asset Configurator (`react set --font`)

Scans `public/fonts/` for `.ttf`, `.woff`, `.woff2`, and `.otf` files:
- Generates `@font-face` declarations pointing to asset paths.
- Appends rules to `src/index.css` and configures Tailwind `@theme` font variables.

```bash
anshh set --font
```

### 4. Image Asset Map Generator (`react set --image`)

Scans `public/images/` and outputs a camelCased asset map in `src/utils/images.js`:

```javascript
import { images } from '../utils/images'

const Banner = () => <img src={images.heroBanner} alt="Hero" />
```

---

## Performance & Engine Optimizations

`Spark CLI` is optimized for instant execution and minimal I/O overhead:

1. **Native `node:fs/promises` Engine**: Replaced heavy file wrappers with native `node:fs/promises` (`mkdir`, `access`, `readFile`, `writeFile`, `rm`, `cp`) for **2x-3x faster** file operations.
2. **Fast Package Manager Auto-Detection (`detectPackageManager`)**: Automatically checks for `bun`, `pnpm`, or `yarn` on the developer's system to install dependencies in **under 1 second** (falling back to `npm install --prefer-offline`).
3. **Parallelized File Creation (`Promise.all`)**: Scaffolds template files, Vite configs, CSS styles, and imports concurrently.

---

## Git & Security Protection

- **Automated `.env` Gitignore Protection**: Whenever a project is created or `.env` is configured, `Spark CLI` automatically generates or updates `.gitignore` to ensure `.env`, `.env.local`, and `.env.*.local` are **never accidentally pushed to Git remotes**.
- **Formatted Git Stream**: `react push` / `anshh push` outputs colorized git status stream showing branch names (`[main 8152f98]`), insertions (`+`), deletions (`-`), and file modes in real time.

---

## Package Installer

Use `pkg` inside an existing project:

```bash
pkg axios
pkg router toast
pkg qr webcam printer
pkg --dev @types/node
```

Short aliases: `tailwind`, `axios`, `socket`, `toast`, `icon`, `lucide`, `router`, `qr`, `webcam`, `printer`.

---

## Maintenance

Check syntax after making changes to the CLI:

```bash
node --check bin/index.js
node --check bin/get.js
node --check lib/shared.js
```

---

## License

MIT License. Designed and implemented by **Anshh**.
