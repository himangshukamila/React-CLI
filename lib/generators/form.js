import path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
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

    const hasPasswordField = fields.some((f) => getFieldInputType(f) === 'password')

    const lucideIconsUsed = ['Send', 'CheckCircle2', 'XCircle', 'Loader2']
    if (hasPasswordField) {
      lucideIconsUsed.push('Eye', 'EyeOff')
    }
    const lucideImportStr = Array.from(new Set(lucideIconsUsed)).join(', ')

    const isGrid = fields.length >= 4
    const formLayoutClass = isGrid ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-4'

    const fieldBlocks = fields.map((f) => {
      const inputType = getFieldInputType(f)
      const labelText = formatFieldLabel(f)
      const isPassword = inputType === 'password'
      const lowerF = f.toLowerCase()

      let maxLenProp = 'maxLength={50}'
      if (lowerF.includes('name')) maxLenProp = 'maxLength={25}'
      else if (lowerF.includes('email')) maxLenProp = 'maxLength={30}'
      else if (lowerF.includes('phone') || lowerF.includes('mobile')) maxLenProp = 'maxLength={10}'
      else if (lowerF.includes('pincode') || lowerF.includes('zip')) maxLenProp = 'maxLength={6}'
      else if (lowerF.includes('age')) maxLenProp = 'maxLength={3}'
      else if (lowerF.includes('password')) maxLenProp = 'maxLength={30}'
      else if (lowerF.includes('url') || lowerF.includes('website')) maxLenProp = 'maxLength={100}'
      else if (lowerF.includes('address') || lowerF.includes('bio') || lowerF.includes('message')) maxLenProp = 'maxLength={250}'

      const labelSizeClass = 'text-xs'
      const inputSizeClass = 'text-sm'

      return `        {/* ${labelText} Field */}
        <div className="space-y-1.5 group">
          <label htmlFor="${f}" style={labelStyle} className={\`block ${labelSizeClass} font-semibold uppercase tracking-wider text-zinc-400 transition-colors group-focus-within:text-cyan-400\`}>
            ${labelText}
          </label>
          <div className="relative flex items-center">
            <input
              id="${f}"
              name="${f}"
              type=${isPassword ? `{showPassword ? 'text' : 'password'}` : `"${inputType}"`}
              value={formData.${f}}
              onChange={handleChange}
              placeholder="Enter ${labelText.toLowerCase()}..."
              disabled={isSubmitting}
              ${maxLenProp}
              style={inputStyle}
              className={\`w-full bg-zinc-900/90 text-zinc-100 ${inputSizeClass} rounded-xl pl-4 ${isPassword ? 'pr-10' : 'pr-4'} py-2.5 border border-zinc-800 focus:border-cyan-500/80 focus:ring-4 focus:ring-cyan-500/15 outline-none transition-all duration-200 placeholder:text-zinc-600 disabled:opacity-60 disabled:cursor-not-allowed\`}
            />
${isPassword ? `            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>` : ''}
          </div>
        </div>`
    }).join('\n\n')

    const formJsxContent = `import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { ${lucideImportStr} } from 'lucide-react'

const formatUnit = (val, defaultUnit) => {
  if (val === undefined || val === null || val === '') return undefined
  if (typeof val === 'number' || (!isNaN(val) && !String(val).trim().endsWith('%') && !String(val).trim().endsWith('px') && !String(val).trim().endsWith('rem') && !String(val).trim().endsWith('em') && !String(val).trim().endsWith('vw') && !String(val).trim().endsWith('vh'))) {
    return \`\${val}\${defaultUnit}\`
  }
  return val
}

const Form = ({
  title = 'Interactive Form',
  className = '',
  width,
  height,
  maxWidth,
  bgColor = '',
  labelSize,
  inputSize,
  buttonText = 'Submit Form',
  buttonWidth,
  buttonHeight,
  buttonBgColor = '',
  buttonClassName = '',
  style = {},
  validate,
  onSubmit,
  onSubmitSuccess,
}) => {
  const [formData, setFormData] = useState({
${stateInit}
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
${hasPasswordField ? '  const [showPassword, setShowPassword] = useState(false)\n' : ''}
  const parsedWidth = formatUnit(width, 'vw')
  const parsedHeight = formatUnit(height, 'vh')
  const parsedMaxWidth = formatUnit(maxWidth, 'vw')
  const parsedLabelSize = formatUnit(labelSize, 'rem')
  const parsedInputSize = formatUnit(inputSize, 'rem')
  const parsedButtonWidth = formatUnit(buttonWidth, 'vw')
  const parsedButtonHeight = formatUnit(buttonHeight, 'vh')

  const isCustomBgClass = typeof bgColor === 'string' && bgColor.startsWith('bg-')
  const formBgClass = isCustomBgClass ? bgColor : (bgColor ? '' : 'bg-zinc-950/90')

  const containerStyle = {
    ...(parsedWidth && !String(width).startsWith('w-') ? { width: parsedWidth } : {}),
    ...(parsedHeight && !String(height).startsWith('h-') ? { height: parsedHeight } : {}),
    ...(parsedMaxWidth && !String(maxWidth).startsWith('max-w-') ? { maxWidth: parsedMaxWidth } : {}),
    ...(bgColor && !isCustomBgClass ? { backgroundColor: bgColor } : {}),
    ...style,
  }

  const submitButtonStyle = {
    ...(parsedButtonWidth && !String(buttonWidth).startsWith('w-') ? { width: parsedButtonWidth } : {}),
    ...(parsedButtonHeight && !String(buttonHeight).startsWith('h-') ? { height: parsedButtonHeight } : {}),
  }

  const labelStyle = parsedLabelSize ? { fontSize: parsedLabelSize } : {}
  const inputStyle = parsedInputSize ? { fontSize: parsedInputSize } : {}

  const handleChange = (e) => {
    if (isSubmitting) return
    const { name, value } = e.target
    const lowerName = name.toLowerCase()
    let sanitizedValue = value

    if (lowerName.includes('name')) {
      sanitizedValue = value.replace(/[^a-zA-Z\\s]/g, '').slice(0, 25)
    } else if (lowerName.includes('phone') || lowerName.includes('mobile')) {
      sanitizedValue = value.replace(/\\D/g, '').slice(0, 10)
    } else if (lowerName.includes('pincode') || lowerName.includes('zip')) {
      sanitizedValue = value.replace(/\\D/g, '').slice(0, 6)
    } else if (lowerName.includes('age')) {
      sanitizedValue = value.replace(/\\D/g, '').slice(0, 3)
    } else if (lowerName.includes('email')) {
      sanitizedValue = value.slice(0, 30)
    } else if (lowerName.includes('password')) {
      sanitizedValue = value.slice(0, 30)
    } else if (lowerName.includes('url') || lowerName.includes('website')) {
      sanitizedValue = value.slice(0, 100)
    } else if (lowerName.includes('address') || lowerName.includes('bio') || lowerName.includes('message')) {
      sanitizedValue = value.slice(0, 250)
    } else {
      sanitizedValue = value.slice(0, 50)
    }

    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    // 1. Custom validate function check
    if (typeof validate === 'function') {
      const errorMsg = validate(formData)
      if (errorMsg) {
        toast.error(errorMsg)
        return
      }
    }

    // 2. Strict per-field security & format validation
    const fieldKeys = Object.keys(formData)
    for (const key of fieldKeys) {
      const val = String(formData[key] || '').trim()
      const lowerKey = key.toLowerCase()
      const formattedLabel = key.charAt(0).toUpperCase() + key.slice(1)

      if (!val) {
        toast.error(\`\${formattedLabel} is required\`)
        return
      }

      if (lowerKey.includes('name')) {
        if (!/^[a-zA-Z\\s]+$/.test(val)) {
          toast.error(\`\${formattedLabel} must contain only letters\`)
          return
        }
        if (val.length > 25) {
          toast.error(\`\${formattedLabel} cannot exceed 25 characters\`)
          return
        }
      } else if (lowerKey.includes('email')) {
        if (val.length > 30) {
          toast.error(\`\${formattedLabel} cannot exceed 30 characters\`)
          return
        }
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val)) {
          toast.error(\`Please enter a valid \${formattedLabel.toLowerCase()} address\`)
          return
        }
      } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
        if (!/^\\d{10}$/.test(val)) {
          toast.error(\`\${formattedLabel} number must be exactly 10 digits\`)
          return
        }
      } else if (lowerKey.includes('pincode') || lowerKey.includes('zip')) {
        if (!/^\\d{6}$/.test(val)) {
          toast.error(\`\${formattedLabel} must be exactly 6 digits\`)
          return
        }
      } else if (lowerKey.includes('age')) {
        const numAge = Number(val)
        if (isNaN(numAge) || numAge < 1 || numAge > 120) {
          toast.error(\`Please enter a valid age (1-120)\`)
          return
        }
      } else if (lowerKey.includes('password')) {
        if (val.length < 6) {
          toast.error(\`\${formattedLabel} must be at least 6 characters\`)
          return
        }
      } else if (lowerKey.includes('url') || lowerKey.includes('website')) {
        if (!/^https?:\\/\\/.+/.test(val)) {
          toast.error(\`Please enter a valid URL (e.g. https://example.com)\`)
          return
        }
      }
    }


    setIsSubmitting(true)

    try {
      if (typeof onSubmit === 'function') {
        // Tip: Pass { silent: true } in API calls (e.g. api.post('/url', formData, { silent: true })) to handle error toasts here without duplicates from api.js
        await onSubmit(formData, e)
      } else {
        await new Promise((res) => setTimeout(res, 800))
      }

      toast.success('Form submitted successfully!')
      if (typeof onSubmitSuccess === 'function') {
        onSubmitSuccess(formData)
      }
      setFormData({
${stateReset}
      })
    } catch (err) {
      toast.error(err?.friendlyMessage || err?.response?.data?.message || err?.message || 'Form submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormFilled = Object.keys(formData).every((k) => String(formData[k] || '').trim().length > 0)
  const isSubmitDisabled = isSubmitting || !isFormFilled

  const maxWidthClass = typeof maxWidth === 'string' && maxWidth.startsWith('max-w-') ? maxWidth : (parsedMaxWidth ? '' : 'max-w-md')

  const submitButtonBg = buttonBgColor || 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 border border-cyan-400/30'
  const submitButtonWidthClass = typeof buttonWidth === 'string' && buttonWidth.startsWith('w-') ? buttonWidth : (parsedButtonWidth ? '' : 'w-full')

  return (
    <>
      <Toaster
        position="top-center"
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
      <div
        style={containerStyle}
        className={\`w-full \${maxWidthClass} mx-auto \${formBgClass} backdrop-blur-2xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] font-sans \${className}\`}
      >
        {/* Ambient background glow */}
        <div className="absolute -top-24 -left-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Form Header */}
        <div className="mb-6 pb-4 border-b border-zinc-800/60 relative z-10 text-center">
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="${formLayoutClass}">
${fieldBlocks}
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            style={submitButtonStyle}
            className={\`mt-4 relative inline-flex items-center justify-center font-semibold text-sm py-3 px-4 rounded-xl transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:scale-100 \${submitButtonWidthClass} \${submitButtonBg} \${buttonClassName}\`}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
                <span>Submitting...</span>
              </span>
            ) : (
              <>
                <span>{buttonText}</span>
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
    await typeText(chalk.green.bold(`\n✅ src/components/Form.jsx generated with fields: ${fields.join(', ')} and react-hot-toast integration!`))
  } catch (error) {
    fail(error.message)
  }
}
