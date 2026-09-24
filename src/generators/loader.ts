import path from 'node:path'
import chalk from 'chalk'
import { section, pass, fail, typeText } from '../ui/banner.js'
import { ensureDir, readProjectPackageJson } from '../shared.js'
import { writeGenerated } from './safeWrite.js'

export const loaderContent = `// blur strengths are written out in full so Tailwind can see them
const blurClasses = {
  none: '',
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
  xl: 'backdrop-blur-xl',
}

const withAlpha = (hex, alpha) => {
  const value = String(hex).replace('#', '')
  if (value.length !== 3 && value.length !== 6) return hex
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const int = parseInt(full, 16)
  return \`rgba(\${(int >> 16) & 255}, \${(int >> 8) & 255}, \${int & 255}, \${alpha})\`
}

const Loader = ({
  text = 'Please wait...',
  variant = 'spinner',
  color = '#1059DD',
  background = '#060818',
  opacity = 0.8,
  size = 56,
  blur = 'sm',
  overlay = true,
  className = '',
  textClassName = '',
}) => {
  // colors and sizes are inline because Tailwind cannot compile class names
  // built from props at runtime
  const indicators = {
    spinner: (
      <div
        className="rounded-full animate-spin"
        style={{
          width: size,
          height: size,
          border: \`\${Math.max(2, Math.round(size / 14))}px solid rgba(255,255,255,0.2)\`,
          borderTopColor: color,
        }}
      />
    ),
    dots: (
      <div className="flex items-end" style={{ gap: size / 6 }}>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="rounded-full animate-bounce"
            style={{
              width: size / 4,
              height: size / 4,
              background: color,
              animationDelay: \`\${index * 0.15}s\`,
            }}
          />
        ))}
      </div>
    ),
    bars: (
      <div className="flex items-center" style={{ gap: size / 8 }}>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="rounded-sm animate-pulse"
            style={{
              width: size / 8,
              height: size,
              background: color,
              animationDelay: \`\${index * 0.12}s\`,
            }}
          />
        ))}
      </div>
    ),
    pulse: (
      <span className="relative flex" style={{ width: size, height: size }}>
        <span
          className="absolute inline-flex h-full w-full rounded-full animate-ping"
          style={{ background: color, opacity: 0.6 }}
        />
        <span className="relative inline-flex h-full w-full rounded-full" style={{ background: color }} />
      </span>
    ),
  }

  const positionClass = overlay
    ? \`absolute inset-0 z-30 \${blurClasses[blur] ?? blurClasses.sm}\`
    : 'relative'

  return (
    <div
      className={\`flex flex-col items-center justify-center h-full w-full \${positionClass} \${className}\`}
      style={overlay ? { backgroundColor: withAlpha(background, opacity) } : undefined}
      role="status"
      aria-live="polite"
    >
      {indicators[variant] || indicators.spinner}

      {text && (
        <p
          className={\`text-white text-[1.1rem] tracking-wide \${textClassName}\`}
          style={{ marginTop: size / 3.5 }}
        >
          {text}
        </p>
      )}
    </div>
  )
}

export default Loader
`

export const configureLoaderBoilerplate = async (projectPath: string = process.cwd()): Promise<void> => {
  try {
    await readProjectPackageJson(projectPath)

    section('loader generator', 'building styled backdrop Loader.jsx component')

    const componentsDir = path.join(projectPath, 'src', 'components')
    await ensureDir(componentsDir)

    const written = await writeGenerated(
      path.join(componentsDir, 'Loader.jsx'),
      loaderContent,
      { projectRoot: projectPath }
    )

    if (!written) return

    pass('created src/components/Loader.jsx')
    await typeText(
      chalk.green.bold(
        '\n✅ src/components/Loader.jsx created!\n' +
          '   Props: variant (spinner | dots | bars | pulse), color, background, opacity,\n' +
          '   size, blur, overlay, text, className, textClassName.'
      )
    )
  } catch (error: any) {
    fail(error.message)
  }
}
