#!/usr/bin/env node

import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { typeText } from '../ui/banner.js';
import {
  aliasMap,
  createPackageHandlers,
  detectPackageManager,
  getBasePackageName,
  pathExists,
  resolvePackageName,
  reverseAliasMap,
  runCommand,
} from '../shared.js';

const packageNameRegex = /^(@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_.-]+$/;

const fail = (message: string): never => {
  console.error(chalk.red(message));
  process.exit(1);
};

const validatePackageName = (packageName: string): void => {
  const baseName = getBasePackageName(packageName);
  const slashCount = baseName.split("/").length - 1;
  const isScopedPackage = baseName.startsWith("@") && slashCount === 1;

  if (
    !baseName ||
    !packageNameRegex.test(baseName) ||
    packageName.includes("..") ||
    (baseName.includes("/") && !isScopedPackage)
  ) {
    fail(`Invalid package name: ${packageName}`);
  }
};

const formatInstallOutput = (rawOut: string): string => {
  if (!rawOut) return '';

  const lines: string[] = [];

  const auditedMatch = rawOut.match(/audited (\d+ packages) in ([\d\.\w]+)/i) || rawOut.match(/added (\d+ packages?)(?: in ([\d\.\w]+))?/i);
  const upToDateMatch = rawOut.match(/up to date/i);

  if (auditedMatch) {
    const pkgs = auditedMatch[1];
    const time = auditedMatch[2] ? `in ${auditedMatch[2]}` : '';
    lines.push(`${chalk.hex('#00E5FF')('⚡')} ${chalk.bold.whiteBright('Audited')} ${chalk.hex('#38BDF8')(pkgs)} ${chalk.hex('#94A3B8')(time)}`);
  } else if (upToDateMatch) {
    const timeMatch = rawOut.match(/up to date in ([\d\.\w]+)/i);
    const time = timeMatch ? `in ${timeMatch[1]}` : '';
    lines.push(`${chalk.hex('#00E5FF')('⚡')} ${chalk.bold.whiteBright('Dependencies')} ${chalk.hex('#10B981')('up to date')} ${chalk.hex('#94A3B8')(time)}`);
  }

  const fundingMatch = rawOut.match(/(\d+ packages? (?:is|are) looking for funding)/i);
  if (fundingMatch) {
    lines.push(`${chalk.hex('#F59E0B')('♥︎')} ${chalk.hex('#F59E0B')(fundingMatch[1])}`);
  }

  const vulnMatch = rawOut.match(/found (\d+ vulnerabilities(?: \([\s\S]*?\))?)/i);
  if (vulnMatch) {
    const vulnsText = vulnMatch[1];
    if (vulnsText.includes('0 vulnerabilities')) {
      lines.push(`${chalk.hex('#10B981')('⚔︎')} ${chalk.hex('#10B981').bold('0 vulnerabilities')} ${chalk.hex('#94A3B8')('· security check passed')}`);
    } else {
      lines.push(`${chalk.hex('#EF4444')('☮︎')} ${chalk.hex('#EF4444').bold(vulnsText)}`);
    }
  }

  if (lines.length === 0) {
    return rawOut;
  }

  return lines.join('\n');
};

const postInstallHandlers: Record<
  string,
  (projectPath: string) => Promise<void>
> = createPackageHandlers({ installPackages: false });

export interface InstallPackagesOptions {
  dev?: boolean;
}

const installPackages = async (
  packageNames: string[],
  options: InstallPackagesOptions,
): Promise<void> => {
  try {
    if (packageNames.length === 0) {
      fail("Provide at least one package to install");
    }

    for (const packageName of packageNames) {
      validatePackageName(packageName);
    }

    const projectPath = process.cwd();
    const packageJsonPath = path.join(projectPath, "package.json");
    if (!(await pathExists(packageJsonPath))) {
      fail("Not inside a node project. Run react first.");
    }

    const resolvedPackages = packageNames.map(resolvePackageName);

    for (let i = 0; i < packageNames.length; i++) {
      const packageName = packageNames[i];
      const resolvedPackage = resolvedPackages[i];
      if (packageName !== resolvedPackage) {
        await typeText(chalk.blue(`${packageName} -> ${resolvedPackage}`), 10);
      }
    }

    const normalPackages: string[] = [];
    const devPackages: string[] = [];

    for (let index = 0; index < packageNames.length; index++) {
      const packageName = packageNames[index];
      const baseName = getBasePackageName(packageName);
      const resolvedPackage = resolvedPackages[index];
      const isTailwind =
        baseName === "tailwind" ||
        getBasePackageName(resolvedPackage) === "tailwindcss";

      if (isTailwind) {
        normalPackages.push("tailwindcss", "@tailwindcss/vite");
      } else if (options.dev) {
        devPackages.push(resolvedPackage);
      } else {
        normalPackages.push(resolvedPackage);
      }
    }

    const uniqueNormalPackages = [...new Set(normalPackages)];
    const uniqueDevPackages = [...new Set(devPackages)];

    const pm = await detectPackageManager();

    if (uniqueNormalPackages.length > 0) {
      let args: string[] = [];
      if (pm === "bun" || pm === "pnpm" || pm === "yarn") {
        args = ["add", ...uniqueNormalPackages];
      } else {
        args = ["install", ...uniqueNormalPackages];
      }
      const res = await runCommand(
        pm,
        args,
        { cwd: projectPath },
        "Failed to install packages",
      );
      const out = (res?.stdout || res?.stderr || "").trim();
      if (out) {
        await typeText(formatInstallOutput(out), 12);
      }
    }

    if (uniqueDevPackages.length > 0) {
      let devArgs: string[] = [];
      if (pm === "bun" || pm === "pnpm" || pm === "yarn") {
        devArgs = ["add", "-D", ...uniqueDevPackages];
      } else {
        devArgs = ["install", "-D", ...uniqueDevPackages];
      }
      const devRes = await runCommand(
        pm,
        devArgs,
        { cwd: projectPath },
        "Failed to install dev packages",
      );
      const devOut = (devRes?.stdout || devRes?.stderr || "").trim();
      if (devOut) {
        await typeText(formatInstallOutput(devOut), 12);
      }
    }

    const handlersToRun = new Set<string>();
    for (const packageName of packageNames) {
      const baseName = getBasePackageName(packageName);
      const resolvedPackage = resolvePackageName(packageName);
      const resolvedBase = getBasePackageName(resolvedPackage);
      const handlerName = aliasMap[baseName]
        ? baseName
        : reverseAliasMap[resolvedBase];
      if (handlerName && postInstallHandlers[handlerName]) {
        handlersToRun.add(handlerName);
      }
    }

    for (const handlerName of handlersToRun) {
      await postInstallHandlers[handlerName](projectPath);
    }

    await typeText(chalk.green(`Installed ${resolvedPackages.join(", ")} ✓`), 18);
  } catch (error: any) {
    fail(error.message);
  }
};

const program = new Command();

program
  .name("get")
  .description("Install packages in the current React project")
  .argument("[packages...]", "packages or aliases to install")
  .option("--dev", "install as dev dependencies")
  .action(installPackages);

program.parseAsync(process.argv).catch((error: any) => {
  fail(error.message);
});
