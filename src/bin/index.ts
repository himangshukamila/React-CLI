#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { registerAllCommands } from "../commands/cli/index.js";

process.on("SIGINT", () => {
  console.log(chalk.hex("#94A3B8")("\nOperation cancelled ❎\n"));
  process.exit(0);
});

const program = new Command();

program.name("react").description("Scaffold a Vite + React project");

registerAllCommands(program);
(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
})();
