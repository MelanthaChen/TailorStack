import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabasePools, getDatabasePool } from "../../packages/database/src/index.js";
import { loadConfig } from "../../packages/config/src/index.js";

const rootDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const pidPath = join(rootDir, ".local", "dev", "pids.json");
const children = new Map();
let shuttingDown = false;

await main();

async function main() {
  process.chdir(rootDir);
  await mkdir(dirname(pidPath), { recursive: true });
  await run("infra", dockerCommand(), ["compose", "-f", "infra/docker/docker-compose.yml", "up", "-d"], { wait: true });
  await waitForPostgres();

  const api = start("api", npmCommand(), ["run", "dev:api"]);
  const web = start("web", npmCommand(), ["run", "dev:web"]);
  await writeFile(pidPath, JSON.stringify({ api: api.pid, web: web.pid, infrastructure: "running" }, null, 2));

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
}

async function waitForPostgres() {
  const config = loadConfig();
  const pool = getDatabasePool(config);
  const startedAt = Date.now();
  const timeoutMs = 60_000;
  for (;;) {
    try {
      if (await pool.healthCheck()) {
        log("infra", "PostgreSQL ready");
        await closeDatabasePools();
        return;
      }
    } catch {
      // Keep waiting until the Docker healthcheck and TCP listener are ready.
    }
    if (Date.now() - startedAt > timeoutMs) {
      await closeDatabasePools();
      throw new Error("Timed out waiting for PostgreSQL");
    }
    await sleep(1000);
  }
}

function start(prefix, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: process.env
  });
  children.set(prefix, child);
  prefixStream(prefix, child.stdout);
  prefixStream(prefix, child.stderr);
  child.on("exit", (code, signal) => {
    children.delete(prefix);
    if (!shuttingDown && code !== 0) {
      log(prefix, `exited with ${signal ?? code}`);
      shutdown(code ?? 1);
    }
  });
  return child;
}

function run(prefix, command, args, { wait = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = start(prefix, command, args);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${prefix} command failed with exit code ${code}`));
    });
    if (!wait) resolve(child);
  });
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("dev", "Stopping API and Web. Docker infrastructure is left running; use npm run stop to stop it.");
  for (const child of children.values()) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500).unref();
}

function prefixStream(prefix, stream) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line) log(prefix, line);
    }
  });
}

function log(prefix, message) {
  process.stdout.write(`[${prefix}] ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function dockerCommand() {
  return process.platform === "win32" ? "docker.exe" : "docker";
}
