import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const command = process.argv[2];
if (command !== "dev" && command !== "build") {
  console.error("Expected desktop frontend command: dev or build.");
  process.exit(1);
}

const frontendEnvironment = { ...process.env };
delete frontendEnvironment.GOOGLE_DESKTOP_CLIENT_SECRET;
const bundledNpmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npmCli = process.env.npm_execpath || (existsSync(bundledNpmCli) ? bundledNpmCli : null);

if (!npmCli) {
  console.error("Unable to locate npm's JavaScript CLI. Run the desktop command through npm.");
  process.exit(1);
}

const child = spawn(process.execPath, [npmCli, "run", command], {
  env: frontendEnvironment,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Unable to start the desktop frontend: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
