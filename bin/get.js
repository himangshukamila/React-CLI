#!/usr/bin/env node

import path from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import {
  aliasMap,
  createPackageHandlers,
  getBasePackageName,
  pathExists,
  resolvePackageName,
  reverseAliasMap,
  runCommand,
} from '../lib/shared.js'

const packageNameRegex = /^(@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_.-]+$/

const fail = (message) => {
  console.error(chalk.red(message))
  process.exit(1)
}

const validatePackageName = (packageName) => {
  const baseName = getBasePackageName(packageName)
  const slashCount = baseName.split('/').length - 1
  const isScopedPackage = baseName.startsWith('@') && slashCount === 1

  if (
    !baseName ||
    !packageNameRegex.test(baseName) ||
    packageName.includes('..') ||
    (baseName.includes('/') && !isScopedPackage)
  ) {
    fail(`Invalid package name: ${packageName}`)
  }
}

const postInstallHandlers = createPackageHandlers({ installPackages: false })

const installPackages = async (packageNames, options) => {
  try {
    if (packageNames.length === 0) {
      fail('Provide at least one package to install')
    }

    for (const packageName of packageNames) {
      validatePackageName(packageName)
    }

    const projectPath = process.cwd()
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (!(await pathExists(packageJsonPath))) {
      fail('Not inside a node project. Run react first.')
    }

    const resolvedPackages = packageNames.map(resolvePackageName)

    packageNames.forEach((packageName, index) => {
      const resolvedPackage = resolvedPackages[index]
      if (packageName !== resolvedPackage) {
        console.log(chalk.gray(`${packageName} → ${resolvedPackage}`))
      }
    })

    const normalPackages = []
    const devPackages = []

    for (let index = 0; index < packageNames.length; index++) {
      const packageName = packageNames[index]
      const baseName = getBasePackageName(packageName)
      const resolvedPackage = resolvedPackages[index]
      const isTailwind = baseName === 'tailwind' || getBasePackageName(resolvedPackage) === 'tailwindcss'

      if (isTailwind) {
        normalPackages.push('tailwindcss', '@tailwindcss/vite')
      } else if (options.dev) {
        devPackages.push(resolvedPackage)
      } else {
        normalPackages.push(resolvedPackage)
      }
    }

    const uniqueNormalPackages = [...new Set(normalPackages)]
    const uniqueDevPackages = [...new Set(devPackages)]

    if (uniqueNormalPackages.length > 0) {
      await runCommand('npm', ['install', ...uniqueNormalPackages], { cwd: projectPath }, 'Failed to install packages')
    }

    if (uniqueDevPackages.length > 0) {
      await runCommand('npm', ['install', '-D', ...uniqueDevPackages], { cwd: projectPath }, 'Failed to install dev packages')
    }

    const handlersToRun = new Set()
    for (const packageName of packageNames) {
      const baseName = getBasePackageName(packageName)
      const resolvedPackage = resolvePackageName(packageName)
      const resolvedBase = getBasePackageName(resolvedPackage)
      const handlerName = aliasMap[baseName] ? baseName : reverseAliasMap[resolvedBase]
      if (handlerName && postInstallHandlers[handlerName]) {
        handlersToRun.add(handlerName)
      }
    }

    for (const handlerName of handlersToRun) {
      await postInstallHandlers[handlerName](projectPath)
    }

    console.log(chalk.green(`Installed ${resolvedPackages.join(', ')}`))
  } catch (error) {
    fail(error.message)
  }
}

const program = new Command()

program
  .name('pkg')
  .description('Install packages in the current React project')
  .argument('[packages...]', 'packages or aliases to install')
  .option('--dev', 'install as dev dependencies')
  .action(installPackages)

program.parseAsync(process.argv).catch((error) => {
  fail(error.message)
})
