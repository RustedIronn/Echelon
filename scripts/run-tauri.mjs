import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const env = { ...process.env };
const tauriArgs = process.argv.slice(2);
const desktopCommand = tauriArgs[0];
const desktopEnvironmentPath = resolve(".env.desktop");

function parseEnvironmentFile(contents) {
  const values = {};
  for (const sourceLine of contents.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().replace(/^export\s+/u, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

if (existsSync(desktopEnvironmentPath)) {
  const desktopValues = parseEnvironmentFile(readFileSync(desktopEnvironmentPath, "utf8"));
  for (const [key, value] of Object.entries(desktopValues)) {
    if (env[key] == null || env[key] === "") env[key] = value;
  }
}

if (["dev", "build"].includes(desktopCommand)) {
  const missing = ["VITE_GOOGLE_DESKTOP_CLIENT_ID", "GOOGLE_DESKTOP_CLIENT_SECRET"]
    .filter((key) => !env[key]?.trim());
  if (missing.length) {
    console.error(`Desktop OAuth configuration is missing: ${missing.join(", ")}. Add the value${missing.length > 1 ? "s" : ""} to .env.desktop.`);
    process.exit(1);
  }
}
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
const cargoDirectory = join(homedir(), ".cargo", "bin");
const cargoExecutable = join(
  cargoDirectory,
  process.platform === "win32" ? "cargo.exe" : "cargo",
);

if (existsSync(cargoExecutable)) {
  const currentPath = env[pathKey] ?? "";
  const pathEntries = currentPath.split(delimiter);
  const alreadyAvailable = pathEntries.some(
    (entry) => resolve(entry || ".").toLowerCase() === resolve(cargoDirectory).toLowerCase(),
  );

  if (!alreadyAvailable) {
    env[pathKey] = `${cargoDirectory}${delimiter}${currentPath}`;
  }
}

const tauriCli = resolve("node_modules", "@tauri-apps", "cli", "tauri.js");
const child = spawn(process.execPath, [tauriCli, ...tauriArgs], {
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Unable to start the Tauri CLI: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
