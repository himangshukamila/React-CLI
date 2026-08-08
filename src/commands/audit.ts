import path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
import { section, pass, warn, fail, muted, strong, typeText } from '../ui/banner.js'
import { customConfirm } from '../ui/prompts.js'
import { pathExists } from '../shared.js'

export const runAudit = async (): Promise<void> => {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    if (!(await pathExists(packageJsonPath))) {
      warn('package.json missing', 'run this inside a Node/React project')
      return
    }

    section('audit', 'dependency vulnerability check')
    await typeText(muted('Running security audit...\n'))

    const auditRes = await execa('npm', ['audit', '--json'], { cwd: process.cwd(), reject: false })

    if (auditRes.exitCode >= 2) {
      throw new Error(`npm audit failed to execute: ${auditRes.stderr || auditRes.stdout}`)
    }

    let auditData: any
    try {
      auditData = JSON.parse(auditRes.stdout)
    } catch (e: any) {
      if (auditRes.stderr && auditRes.stderr.includes('ENOTFOUND')) {
        throw new Error('Network error: Could not reach the npm registry. Please check your internet connection.')
      }
      throw new Error(`Failed to parse npm audit output: ${auditRes.stderr || auditRes.stdout || e.message}`)
    }

    const vulnerabilities = auditData.vulnerabilities || {}
    const vulnKeys = Object.keys(vulnerabilities)
    const total = auditData.metadata?.vulnerabilities?.total || vulnKeys.length

    if (total === 0 || vulnKeys.length === 0) {
      pass('No vulnerabilities found!')
      await typeText(`\nHello! Your project looks completely secure. The project is safe for further development process.\n `)
      return
    }

    const counts = auditData.metadata?.vulnerabilities || {}
    const countSummary: string[] = []
    if (counts.critical) countSummary.push(`${counts.critical} critical`)
    if (counts.high) countSummary.push(`${counts.high} high`)
    if (counts.moderate) countSummary.push(`${counts.moderate} moderate`)
    if (counts.low) countSummary.push(`${counts.low} low`)
    if (counts.info) countSummary.push(`${counts.info} info`)

    const countStr = countSummary.join(', ') || `${total} total`
    await typeText(chalk.red(`Found ${total} vulnerabilities (${countStr})\n`))

    for (const pkgName of vulnKeys) {
      const vuln = vulnerabilities[pkgName]
      const severity = vuln.severity
      const via = vuln.via || []

      const reasons = via.map((v: any) => (typeof v === 'object' ? v.title : `dependent package "${v}"`)).filter(Boolean)
      const reasonStr = reasons.length > 0 ? reasons.join('; ') : 'Unknown issue'

      const directStr = vuln.isDirect ? chalk.yellow('direct dependency') : chalk.gray('transitive dependency')
      const severityColor = severity === 'critical' || severity === 'high' ? chalk.red : chalk.yellow

      await typeText(`  ${strong(pkgName)} (${severityColor(severity)})`)
      await typeText(`  ${muted('├─ type:')}     ${directStr}`)
      await typeText(`  ${muted('├─ reason:')}   ${chalk.white(reasonStr)}`)

      if (vuln.fixAvailable) {
        if (typeof vuln.fixAvailable === 'object') {
          const fix = vuln.fixAvailable
          const semverStr = fix.isSemVerMajor ? chalk.red('major breaking update') : chalk.green('semver compatible')
          await typeText(`  ${muted('└─ fix:')}      ${chalk.green(`upgrade to ${fix.name}@${fix.version}`)} (${semverStr})`)
        } else if (vuln.fixAvailable === true) {
          await typeText(`  ${muted('└─ fix:')}      ${chalk.green('fix available via npm audit fix')}`)
        } else {
          await typeText(`  ${muted('└─ fix:')}      ${chalk.gray('no simple fix available')}`)
        }
      } else {
        await typeText(`  ${muted('└─ fix:')}      ${chalk.gray('no fix available')}`)
      }
      console.log('')
    }

    const confirmFix = await customConfirm({
      message: 'Would you like to run audit fix?',
      initialValue: true,
    })

    if (!confirmFix) {
      await typeText(chalk.yellow('\nAudit fix aborted.'))
      return
    }

    await typeText(chalk.gray('\nRunning npm audit fix...'))
    const fixRes = await execa('npm', ['audit', 'fix'], { cwd: process.cwd(), reject: false })

    if (fixRes.stdout && fixRes.stdout.trim()) {
      const stdoutLines = fixRes.stdout.trim().split('\n')
      for (const line of stdoutLines) {
        await typeText(`  ${chalk.hex('#8B5CF6')('│')} ${chalk.hex('#CBD5E1')(line)}`, 4)
      }
    }
    if (fixRes.stderr && fixRes.stderr.trim()) {
      const stderrLines = fixRes.stderr.trim().split('\n')
      for (const line of stderrLines) {
        await typeText(`  ${chalk.hex('#EF4444')('│')} ${chalk.hex('#FCA5A5')(line)}`, 4)
      }
    }

    await typeText(chalk.gray('\nVerifying resolutions...'))
    const postAuditRes = await execa('npm', ['audit', '--json'], { cwd: process.cwd(), reject: false })

    let postAuditData: any
    try {
      postAuditData = JSON.parse(postAuditRes.stdout)
    } catch (_e) {
      postAuditData = { vulnerabilities: {} }
    }

    const postVulns = postAuditData.vulnerabilities || {}
    const postKeys = Object.keys(postVulns)

    const resolvedList: { name: string; severity: string; reason: string }[] = []
    const remainingList: { name: string; severity: string; reason: string }[] = []

    for (const pkgName of vulnKeys) {
      if (!postVulns[pkgName]) {
        const preVuln = vulnerabilities[pkgName]
        const via = preVuln.via || []
        const reasons = via.map((v: any) => (typeof v === 'object' ? v.title : `dependent package "${v}"`)).filter(Boolean)
        resolvedList.push({ name: pkgName, severity: preVuln.severity, reason: reasons.join('; ') })
      }
    }

    for (const pkgName of postKeys) {
      const postVuln = postVulns[pkgName]
      const via = postVuln.via || []
      const reasons = via.map((v: any) => (typeof v === 'object' ? v.title : `dependent package "${v}"`)).filter(Boolean)
      remainingList.push({ name: pkgName, severity: postVuln.severity, reason: reasons.join('; ') })
    }

    await typeText(`\n${chalk.hex('#10B981').bold('✔ Audit fix complete!')}\n`)

    if (resolvedList.length > 0) {
      await typeText(chalk.green.bold('Resolved:'))
      for (const r of resolvedList) {
        await typeText(`  ${chalk.green('✔')} ${strong(r.name)} (${chalk.green(r.severity)}) - ${r.reason}`)
      }
      console.log('')
    }

    if (remainingList.length > 0) {
      await typeText(chalk.yellow.bold('Remaining Issues:'))
      for (const r of remainingList) {
        await typeText(`  ${chalk.yellow('⚠')} ${strong(r.name)} (${chalk.yellow(r.severity)}) - ${r.reason}`)
      }
      await typeText(`\n${muted('Some vulnerabilities could not be auto-resolved. They may require manual dependency updates or npm audit fix --force.')}\n`)
    } else {
      await typeText(chalk.green('All vulnerabilities have been resolved successfully! The project is safe for further development process.\n'))
    }
  } catch (error: any) {
    fail(error.message)
  }
}
