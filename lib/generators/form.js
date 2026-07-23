import path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
import fs from 'fs-extra'
import { section, pass, fail, typeText } from '../ui/banner.js'
import { ensureDir, writeFile, pathExists, readFile } from '../shared.js'

export const extractRawFormFields = (rawArgs = []) => {
  const fields = []
  rawArgs.forEach((arg) => {
    if (typeof arg !== 'string') return
    const clean = arg.replace(/^--?/, '').trim()
    if (clean && clean.toLowerCase() !== 'form' && clean.toLowerCase() !== 'set') {
      clean.split(/[\s,]+/).forEach((f) => {
        const fieldKey = f.replace(/^--?/, '').trim()
        if (fieldKey && !fields.includes(fieldKey)) {
          fields.push(fieldKey)
        }
      })
    }
  })
  return fields
}

export const getExistingFormFields = async (formJsxPath) => {
  try {
    const exists = await pathExists(formJsxPath)
    if (!exists) return []
    const content = await readFile(formJsxPath, 'utf8')
    const match = content.match(/const\s+\[formData,\s+setFormData\]\s*=\s*useState\(\{([\s\S]*?)\}\)/)
    if (match && match[1]) {
      const keys = []
      const lines = match[1].split('\n')
      lines.forEach((line) => {
        const keyMatch = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/)
        if (keyMatch && keyMatch[1] && !keys.includes(keyMatch[1])) {
          keys.push(keyMatch[1])
        }
      })
      return keys
    }
  } catch (e) {
    return []
  }
  return []
}

export const getFieldLucideIcon = (fieldName) => {
  const key = fieldName.toLowerCase()
  if (key.includes('email') || key.includes('mail')) return 'Mail'
  if (key.includes('phone') || key.includes('tel') || key.includes('mobile') || key.includes('contact')) return 'Phone'
  if (key.includes('location') || key.includes('address') || key.includes('city') || key.includes('country') || key.includes('state') || key.includes('zip')) return 'MapPin'
  if (key.includes('password') || key.includes('pass') || key.includes('pin') || key.includes('secret')) return 'Lock'
  if (key.includes('date') || key.includes('dob') || key.includes('birth')) return 'Calendar'
  if (key.includes('search') || key.includes('find')) return 'Search'
  if (key.includes('url') || key.includes('website') || key.includes('link')) return 'Globe'
  if (key.includes('name') || key.includes('user')) return 'User'
  return 'FileText'
}

export const getFieldInputType = (fieldName) => {
  const key = fieldName.toLowerCase()
  if (key.includes('email') || key.includes('mail')) return 'email'
  if (key.includes('password') || key.includes('pass') || key.includes('secret')) return 'password'
  if (key.includes('phone') || key.includes('tel') || key.includes('mobile')) return 'tel'
  if (key.includes('date') || key.includes('dob') || key.includes('birth')) return 'date'
  if (key.includes('age') || key.includes('number') || key.includes('amount') || key.includes('count')) return 'number'
  if (key.includes('url') || key.includes('website')) return 'url'
  return 'text'
}

export const formatFieldLabel = (fieldName) => {
  const clean = fieldName.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  return clean.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export const configureFormBoilerplate = async (rawArgs = []) => {
  try {
    const pkgJsonPath = path.join(process.cwd(), 'package.json')
    if (!await pathExists(pkgJsonPath)) {
      throw new Error('Not inside a React project. Run this from your app folder.')
    }
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))

    const allDeps = {
      ...(pkgJson.dependencies || {}),
      ...(pkgJson.devDependencies || {}),
    }

    const missingDeps = []
    if (!allDeps['react-hot-toast']) missingDeps.push('react-hot-toast')
    if (!allDeps['lucide-react']) missingDeps.push('lucide-react')

    if (missingDeps.length > 0) {
      console.log(chalk.yellow(`Installing missing dependencies: ${missingDeps.join(', ')}...`))
      await execa('npm', ['install', ...missingDeps], { cwd: process.cwd() })
      pass(`installed ${missingDeps.join(', ')}`)
    }

    const componentsDir = path.join(process.cwd(), 'src', 'components')
    const formJsxPath = path.join(componentsDir, 'Form.jsx')

    section('form generator', 'building styled form & react-hot-toast system')

    await ensureDir(componentsDir)

    const newRequestedFields = extractRawFormFields(rawArgs)
    const existingFields = await getExistingFormFields(formJsxPath)

    let fields = []
    if (existingFields.length > 0) {
      fields = [...existingFields]
      newRequestedFields.forEach((f) => {
        if (!fields.includes(f)) {
          fields.push(f)
        }
      })
    } else {
      fields = newRequestedFields.length > 0 ? newRequestedFields : ['name', 'email', 'phone']
    }

    const stateInit = fields.map((f) => `    ${f}: ''`).join(',\n')
    const stateReset = fields.map((f) => `        ${f}: ''`).join(',\n')

    const lucideIconsUsed = Array.from(new Set(fields.map((f) => getFieldLucideIcon(f))))
    lucideIconsUsed.push('Send', 'Sparkles', 'CheckCircle2', 'XCircle')
    const lucideImportStr = Array.from(new Set(lucideIconsUsed)).join(', ')

    const fieldBlocks = fields.map((f) => {
      const iconName = getFieldLucideIcon(f)
      const inputType = getFieldInputType(f)
      const labelText = formatFieldLabel(f)

      return `        {/* ${labelText} Field */}
        <div className="space-y-1.5">
          <label htmlFor="${f}" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            ${labelText}
          </label>
          <div className="relative flex items-center">
            <${iconName} className="absolute left-3.5 w-4 h-4 text-zinc-500 pointer-events-none transition-colors group-focus-within:text-cyan-400" />
            <input
              id="${f}"
              name="${f}"
              type="${inputType}"
              value={formData.${f}}
              onChange={handleChange}
              placeholder="Enter ${labelText.toLowerCase()}..."
              className="w-full bg-zinc-900/90 text-zinc-100 text-sm rounded-xl pl-10 pr-4 py-2.5 border border-zinc-800 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all placeholder:text-zinc-600"
            />
          </div>
        </div>`
    }).join('\n\n')

    const formJsxContent = `import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { ${lucideImportStr} } from 'lucide-react'

const Form = () => {
  const [formData, setFormData] = useState({
${stateInit}
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    setTimeout(() => {
      setIsSubmitting(false)
      toast.success('Form submitted successfully!')
      setFormData({
${stateReset}
      })
    }, 800)
  }

  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#18181b',
            color: '#fff',
            border: '1px solid #27272a',
            borderRadius: '0.75rem',
            padding: '12px 16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            fontSize: '14px',
            fontFamily: 'sans-serif',
          },
          success: {
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
          },
          error: {
            icon: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
          },
        }}
      />
      <div className="w-full max-w-md mx-auto bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 font-sans">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Interactive Form</h2>
            <p className="text-xs text-zinc-400">Fill in the fields below to submit</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
${fieldBlocks}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold py-3 px-4 rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Submit Form</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </>
  )
}

export default Form
`

    await writeFile(formJsxPath, formJsxContent)

    pass(`updated ${path.relative(process.cwd(), formJsxPath)}`)
    await typeText(chalk.green.bold(`\n✔ src/components/Form.jsx generated with fields: ${fields.join(', ')} and react-hot-toast integration!`))
  } catch (error) {
    fail(error.message)
  }
}
