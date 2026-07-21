import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const pidPath = join(rootDir, ".local", "dev", "pids.json");

await main();

async function main() {
  process.chdir(rootDir);
  await stopRecordedProcesses();
  await run("infra", dockerCommand(), ["compose", "-f", "infra/docker/docker-compose.yml", "down"]);
}

async function stopRecordedProcesses() {
  try {
    const pids = JSON.parse(await readFile(pidPath, "utf8"));
    for (const [name, pid] of Object.entries(pids)) {
      if (typeof pid !== "number") continue;
      try {
        process.kill(pid, "SIGTERM");
        log("stop", `Stopped ${name} (${pid})`);
      } catch {
        log("stop", `${name} (${pid}) was not running`);
      }
    }
    await rm(pidPath, { force: true });
  } catch {
    log("stop", "No local dev PID file found");
  }
}

function run(prefix, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: process.env
    });
    prefixStream(prefix, child.stdout);
    prefixStream(prefix, child.stderr);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${prefix} command failed with exit code ${code}`));
    });
  });
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

function dockerCommand() {
  return process.platform === "win32" ? "docker.exe" : "docker";
}
