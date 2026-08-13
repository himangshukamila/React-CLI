import chalk from 'chalk'
import { OptionChoice } from '../types/index.js'

export const accent = chalk.hex('#00E5FF').bold
export const muted = chalk.hex('#679fefff')
export const strong = chalk.bold.whiteBright

export const defaultFlagFolders: string[] = ['components', 'pages', 'hooks', 'utils']
export const packageFlags: string[] = ['tailwind', 'axios', 'zod', 'socket', 'toast', 'icon', 'lucide', 'router', 'qr', 'webcam', 'printer']
export const featureFlags: string[] = ['env', 'watch']
export const setupFlags: string[] = [...packageFlags, ...featureFlags]
export const folderFlags: string[] = featureFlags

export const commandReference: [string, string][] = [
  ['zecron <name>', 'Create a new Vite + React app interactively'],
  ['zecron <name> --ui', 'Configure app setup in a local browser setup wizard GUI'],
  ['zecron .', 'Create Vite + React app in the current directory'],
  ['zecron <name> --tailwind --axios', 'Create an app non-interactively using package flags'],
  ['zecron list -c', 'Show all available CLI commands and usage reference'],
  ['zecron run', 'Run npm run dev with --host 0.0.0.0 enabled'],
  ['zecron run --port 3000', 'Run development server on a specific port'],
  ['zecron run -f', 'Run dev server and open in Firefox Developer Edition'],
  ['zecron build', 'Run production build (npm run build) with completion status'],
  ['zecron build open', 'Run production build and launch preview server (npm run preview)'],
  ['zecron open', 'Launch production preview server on existing dist/ build'],
  ['zecron update', 'Show outdated dependencies without upgrading'],
  ['zecron doctor', 'Audit project health, dependencies, and .env configuration'],
  ['zecron audit', 'Security audit dependencies (npm audit) with auto-fix option'],
  ['zecron env list', 'List Vite environment variables from .env'],
  ['zecron env add VITE_SERVER_URL http://localhost:3000', 'Add or update a VITE_ environment variable in .env'],
  ['zecron env remove VITE_SERVER_URL', 'Remove a VITE_ environment variable from .env'],
  ['zecron make f components/ui', 'Create a directory path under src/'],
  ['zecron make components Button', 'Generate a component file inside an existing src folder'],
  ['zecron asset', 'Create public asset folders (images, icons, fonts)'],
  ['zecron watch', 'Print frontend fetch/XHR API response logs in real time'],
  ['zecron push --git <url>', 'Initialize Git, add remote origin, stage, commit, and push'],
  ['zecron push -m <msg>', 'Stage all changes, commit with message, and push to remote'],
  ['zecron push --github', 'Stage all changes, auto-generate commit message, and push'],
  ['zecron set --font', 'Scan public/fonts, auto-generate @font-face & register in src/index.css'],
  ['zecron set --image', 'Scan public/images and generate src/utils/images.js constants'],
  ['zecron set api -get -post', 'Generate src/services/api.js with selected method flags (-get -post -put -delete -patch)'],
  ['zecron set ws', 'Generate production-grade WebSocket client service in src/services/webSocket.js'],
  ['zecron make form -name -email', 'Generate styled Form component with state, icons & react-hot-toast'],
  ['zecron make loader', 'Generate responsive backdrop-blur Loader (src/components/Loader.jsx)'],
  ['zecron make printer', 'Generate Printer page (src/pages/Printer.jsx) with socket print queue'],
  ['zecron set button', 'Generate reusable Button component (src/components/Button.jsx) with variants & loading state'],
  ['zecron', 'Launch Zecron Interactive Agent Welcome Hub & Prompt Mode'],
  ['get <name>', 'Install a package or alias in an existing project'],
  ['get --dev <name>', 'Install a package as a dev dependency (-D)'],
]
    
export const packageOptions: OptionChoice[] = [
  { value: 'tailwind', label: 'Tailwind CSS', hint: 'style engine + Vite plugin' },
  { value: 'axios', label: 'Axios', hint: 'typed API client starter' },
  { value: 'zod', label: 'Zod', hint: 'TypeScript schema validation' },
  { value: 'socket', label: 'Socket.IO Client', hint: 'realtime websocket layer' },
  { value: 'toast', label: 'React Hot Toast', hint: 'toast notifications + Toaster' },
  { value: 'router', label: 'React Router', hint: 'react-router-dom + src/router' },
  { value: 'qr', label: 'QR Code', hint: 'react-qr-code' },
  { value: 'webcam', label: 'Webcam', hint: 'react-webcam' },
  { value: 'printer', label: 'Print Helper', hint: 'react-to-print' },
  { value: 'icon', label: 'React Icons', hint: 'large icon library' },
  { value: 'lucide', label: 'Lucide React', hint: 'sharp SVG icon set' },
]

export const folderOptions: OptionChoice[] = [
  { value: 'env', label: '.env', hint: 'VITE_SERVER_URL boilerplate' },
  { value: 'assets', label: 'public/assets', hint: 'create public/images and public/fonts' },
  { value: 'components', label: 'src/components', hint: 'reusable interface pieces' },
  { value: 'pages', label: 'src/pages', hint: 'route-level screens' },
  { value: 'watch', label: 'Frontend API Watch', hint: 'adds src/zecron-watch for react watch' },
  { value: 'services', label: 'src/services', hint: 'api clients · data fetchers' },
  { value: 'hooks', label: 'src/hooks', hint: 'custom react hooks' },
  { value: 'utils', label: 'src/utils', hint: 'helper functions' },
  { value: 'store', label: 'src/store', hint: 'state management layer' },
  { value: 'lib', label: 'src/lib', hint: 'third-party configuration' },
  { value: 'types', label: 'src/types', hint: 'shared type contracts' },
]

export const setupLaunchChoices: OptionChoice[] = [
  { value: 'runDevServer', label: 'Run npm run dev after setup', hint: '--host 0.0.0.0' },
]

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const typeText = async (text: string, typingSpeed: number = 12): Promise<void> => {
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

export const section = (label: string, meta: string = ''): void => {
  const rule = chalk.hex('#6366F1')('·'.repeat(54))
  console.log(`\n${accent(label.toUpperCase())} ${rule} ${chalk.hex('#94A3B8')(meta)}`)
}

export const row = (label: string, value: string, hint: string = ''): void => {
  console.log(`${chalk.hex('#38BDF8')(label.padEnd(12))}${strong(value)} ${hint ? chalk.hex('#94A3B8')(` ${hint}`) : ''}`)
}

export const printCommandReference = (): void => {
  section('commands', 'available actions')

  const commandWidth = Math.max(...commandReference.map(([command]) => command.length)) + 2
  commandReference.forEach(([command, purpose]) => {
    console.log(`${chalk.hex('#00E5FF').bold(command.padEnd(commandWidth))}${chalk.whiteBright(purpose)}`)
  })

  console.log(`\n${chalk.hex('#F59E0B').bold('alias')}    ${chalk.whiteBright('zecron or react can be used to run commands.')}`)
}

export const printBanner = (): void => {
  const banner = [
    '███████╗  ███████╗  ██████╗  ██████╗   ██████╗  ███╗   ██╗',
    '╚══███╔╝  ██╔════╝ ██╔════╝  ██╔══██╗ ██╔═══██╗ ████╗  ██║',
    '  ███╔╝   █████╗   ██║       ██████╔╝ ██║   ██║ ██╔██╗ ██║',
    ' ███╔╝    ██╔══╝   ██║       ██╔══██╗ ██║   ██║ ██║╚██╗██║',
    '███████╗  ███████╗ ╚██████╗  ██║  ██║ ╚██████╔╝ ██║ ╚████║',
    '╚══════╝  ╚══════╝  ╚═════╝  ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═══╝',
  ]

  console.log('')
  banner.forEach((line) => console.log(chalk.hex('#00E5FF').bold(line)))
  console.log('')
}

export const pass = (message: string, hint: string = ''): void => {
  console.log(`${chalk.hex('#10B981').bold('✅')} ${chalk.bold.whiteBright(message)} ${hint ? chalk.hex('#94A3B8')(hint) : ''}`)
}

export const warn = (message: string, hint: string = ''): void => {
  console.log(`${chalk.hex('#F59E0B').bold('⚠️')} ${chalk.bold.yellowBright(message)} ${hint ? chalk.hex('#94A3B8')(hint) : ''}`)
}

export const fail = (message: string, hint: string = ''): void => {
  console.error(`${chalk.hex('#EF4444').bold('❌')} ${chalk.bold.redBright(message)} ${hint ? chalk.hex('#94A3B8')(hint) : ''}`)
  process.exit(1)
}

export const printCliHeader = ({ displayName }: { displayName: string; commandTarget?: string }): void => {
  console.log(`${strong('zecron')} ${muted('1.0.0')}  ${muted('·')}  ${muted(`node ${process.versions.node}`)}  ${muted('·')}  ${muted(process.platform)}`)
  console.log(`${muted('type')} ${accent('help')} ${muted('to see commands, run')} ${accent(`zecron ${displayName}`)} ${muted('to begin.')}`)
}
