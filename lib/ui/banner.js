import chalk from 'chalk'

export const accent = chalk.hex('#00E5FF').bold
export const muted = chalk.hex('#679fefff')
export const strong = chalk.bold.whiteBright

export const defaultFlagFolders = ['components', 'pages', 'hooks', 'utils']
export const packageFlags = ['tailwind', 'axios', 'socket', 'toast', 'icon', 'lucide', 'router', 'qr', 'webcam', 'printer']
export const featureFlags = ['env', 'watch']
export const setupFlags = [...packageFlags, ...featureFlags]
export const folderFlags = featureFlags

export const commandReference = [
  ['zenith', 'Launch Zenith Interactive Agent Welcome Hub & Prompt Mode'],
  ['react <name>', 'Create a new Vite + React app interactively'],
  ['react <name> --ui', 'Configure app setup in a local browser setup wizard GUI'],
  ['react .', 'Create Vite + React app in the current directory'],
  ['react <name> --tailwind --axios', 'Create an app non-interactively using package flags'],
  ['react list -c', 'Show all available CLI commands and usage reference'],
  ['react run', 'Run npm run dev with --host 0.0.0.0 enabled'],
  ['react run --port 3000', 'Run development server on a specific port'],
  ['react update', 'Show outdated dependencies without upgrading'],
  ['react doctor', 'Audit project health, dependencies, and .env configuration'],
  ['react audit', 'Security audit dependencies (npm audit) with auto-fix option'],
  ['react env list', 'List Vite environment variables from .env'],
  ['react env add VITE_SERVER_URL http://localhost:3000', 'Add or update a VITE_ environment variable in .env'],
  ['react env remove VITE_SERVER_URL', 'Remove a VITE_ environment variable from .env'],
  ['react make f components/ui', 'Create a directory path under src/'],
  ['react make components Button', 'Generate a component file inside an existing src folder'],
  ['react asset', 'Create public asset folders (images, icons, fonts)'],
  ['react watch', 'Print frontend fetch/XHR API response logs in real time'],
  ['react push --git <url>', 'Initialize Git, add remote origin, stage, commit, and push'],
  ['react push -m <msg>', 'Stage all changes, commit with message, and push to remote'],
  ['react push --github', 'Stage all changes, auto-generate commit message, and push'],
  ['react set --font', 'Scan public/fonts, auto-generate @font-face & register in src/index.css'],
  ['react set --image', 'Scan public/images and generate src/utils/images.js constants'],
  ['react make form -name -email', 'Generate styled Form component with state, icons & react-hot-toast'],
  ['react make loader', 'Generate responsive backdrop-blur Loader (src/components/Loader.jsx)'],
  ['react make printer', 'Generate Printer page (src/pages/Printer.jsx) with socket print queue'],
  ['pkg <name>', 'Install a package or alias in an existing project'],
  ['pkg --dev <name>', 'Install a package as a dev dependency (-D)'],
]

export const packageOptions = [
  { value: 'tailwind', label: 'Tailwind CSS', hint: 'style engine + Vite plugin' },
  { value: 'axios', label: 'Axios', hint: 'typed API client starter' },
  { value: 'socket', label: 'Socket.IO Client', hint: 'realtime websocket layer' },
  { value: 'toast', label: 'React Hot Toast', hint: 'toast notifications + Toaster' },
  { value: 'router', label: 'React Router', hint: 'react-router-dom + src/router' },
  { value: 'qr', label: 'QR Code', hint: 'react-qr-code' },
  { value: 'webcam', label: 'Webcam', hint: 'react-webcam' },
  { value: 'printer', label: 'Print Helper', hint: 'react-to-print' },
  { value: 'icon', label: 'React Icons', hint: 'large icon library' },
  { value: 'lucide', label: 'Lucide React', hint: 'sharp SVG icon set' },
]

export const folderOptions = [
  { value: "env", label: ".env", hint: "VITE_SERVER_URL boilerplate" },
  { value: "assets", label: "public/assets", hint: "create public/images and public/fonts" },
  { value: "components", label: "src/components", hint: "reusable interface pieces" },
  { value: "pages", label: "src/pages", hint: "route-level screens" },
  { value: "watch", label: "Frontend API Watch", hint: "adds src/anshh-watch for react watch" },
  { value: "services", label: "src/services", hint: "api clients · data fetchers" },
  { value: "hooks", label: "src/hooks", hint: "custom react hooks" },
  { value: "utils", label: "src/utils", hint: "helper functions" },
  { value: "store", label: "src/store", hint: "state management layer" },
  { value: "lib", label: "src/lib", hint: "third-party configuration" },
  { value: "types", label: "src/types", hint: "shared type contracts" },
]

export const setupLaunchChoices = [
  { value: 'runDevServer', label: 'Run npm run dev after setup', hint: '--host 0.0.0.0' },
]

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const typeText = async (text, typingSpeed = 12) => {
  if (!text) return
  if (!process.stdout.isTTY) {
    console.log(text)
    return
  }

  const parts = text.split(/(\x1B\[[0-9;]*[A-Za-z])/g)

  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('\x1B[')) {
      process.stdout.write(part)
    } else {
      for (let i = 0; i < part.length; i++) {
        process.stdout.write(part[i])
        await sleep(typingSpeed)
      }
    }
  }
  process.stdout.write('\n')
}

export const section = (label, meta = '') => {
  const rule = chalk.hex('#6366F1')('·'.repeat(54))
  console.log(`\n${accent(label.toUpperCase())} ${rule} ${chalk.hex('#94A3B8')(meta)}`)
}

export const row = (label, value, hint = '') => {
  console.log(`${chalk.hex('#38BDF8')(label.padEnd(12))}${strong(value)} ${hint ? chalk.hex('#94A3B8')(` ${hint}`) : ''}`)
}

export const printCommandReference = () => {
  section('commands', 'available actions')

  const commandWidth = Math.max(...commandReference.map(([command]) => command.length)) + 2
  commandReference.forEach(([command, purpose]) => {
    console.log(`${chalk.hex('#00E5FF').bold(command.padEnd(commandWidth))}${chalk.whiteBright(purpose)}`)
  })

  console.log(`\n${chalk.hex('#F59E0B').bold('alias')}    ${chalk.whiteBright('anshh can be used instead of react if you linked the personal alias.')}`)
}

export const printBanner = () => {
  const banner = [
    " ________        _______         ________         ___        _________      ___  ___     ",
    "|\\_____  \\      |\\  ___ \\       |\\   ___  \\      |\\  \\      |\\___   ___\\   |\\  \\|\\  \\    ",
    " \\|___/  /|     \\ \\   __/|      \\ \\  \\\\ \\  \\     \\ \\  \\     \\|___ \\  \\_|   \\ \\  \\\\\\  \\   ",
    "     /  / /      \\ \\  \\_|/__     \\ \\  \\\\ \\  \\     \\ \\  \\         \\ \\  \\     \\ \\   __  \\  ",
    "    /  /_/__      \\ \\  \\_|\\ \\     \\ \\  \\\\ \\  \\     \\ \\  \\         \\ \\  \\     \\ \\  \\ \\  \\ ",
    "   |\\________\\     \\ \\_______\\     \\ \\__\\\\ \\__\\     \\ \\__\\         \\ \\__\\     \\ \\__\\ \\__\\",
    "    \\|_______|      \\|_______|      \\|__| \\|__|      \\|__|          \\|__|      \\|__|\\|__|",
  ]

  console.log("")
  banner.forEach((line) => console.log(chalk.hex("#1dbbf5").bold(line)))
  console.log("")
}

export const pass = (message, hint = '') => {
  console.log(`${chalk.hex('#10B981').bold('✔')} ${chalk.bold.whiteBright(message)} ${hint ? chalk.hex('#94A3B8')(hint) : ''}`)
}

export const warn = (message, hint = '') => {
  console.log(`${chalk.hex('#F59E0B').bold('⚠')} ${chalk.bold.yellowBright(message)} ${hint ? chalk.hex('#94A3B8')(hint) : ''}`)
}

export const fail = (message, hint = '') => {
  console.error(`${chalk.hex('#EF4444').bold('✖')} ${chalk.bold.redBright(message)} ${hint ? chalk.hex('#94A3B8')(hint) : ''}`)
  process.exit(1)
}

export const printCliHeader = ({ displayName, commandTarget }) => {
  console.log(`${strong('react-cli')} ${muted('1.0.0')}  ${muted('·')}  ${muted(`node ${process.versions.node}`)}  ${muted('·')}  ${muted(process.platform)}`)
  console.log(`${muted('type')} ${accent('help')} ${muted('to see commands, run')} ${accent(`react ${displayName}`)} ${muted('to begin.')}`)
}
