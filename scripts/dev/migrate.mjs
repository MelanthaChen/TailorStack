import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../../packages/config/src/index.js";
import { closeDatabasePools, getDatabasePool } from "../../packages/database/src/index.js";

if (isMainModule(import.meta.url)) {
  await runMigrations();
}

export async function runMigrations({
  config = loadConfig(),
  pool = getDatabasePool(config),
  migrationDir = migrationDirectoryUrl(),
  logger = console
} = {}) {
  const files = await listMigrationSqlFiles(migrationDir);

  if (files.length === 0) {
    logger.log("No SQL migrations found. Migration framework is ready.");
    return { applied: [] };
  }

  try {
    for (const file of files) {
      const sql = await loadMigrationSql(file, migrationDir);
      await pool.transaction(async (client) => {
        for (const statement of splitSqlStatements(sql)) {
          await client.query(statement);
        }
      });
      logger.log(`Applied ${file}`);
    }
    return { applied: files };
  } finally {
    await closeDatabasePools();
  }
}

export function migrationDirectoryUrl(moduleUrl = import.meta.url) {
  return new URL("../../infra/migrations/", moduleUrl);
}

export function resolveMigrationFileUrl(file, migrationDir = migrationDirectoryUrl()) {
  return new URL(file, migrationDir);
}

export async function listMigrationSqlFiles(migrationDir = migrationDirectoryUrl()) {
  return (await readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export async function loadMigrationSql(file, migrationDir = migrationDirectoryUrl()) {
  return readFile(resolveMigrationFileUrl(file, migrationDir), "utf8");
}

export function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDollarQuote = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    if (!inDollarQuote && char === "'" && sql[i - 1] !== "\\") inSingleQuote = !inSingleQuote;
    if (!inSingleQuote && char === "$" && next === "$") {
      inDollarQuote = !inDollarQuote;
      current += "$$";
      i += 1;
      continue;
    }
    if (char === ";" && !inSingleQuote && !inDollarQuote) {
      pushStatement(statements, current);
      current = "";
      continue;
    }
    current += char;
  }
  pushStatement(statements, current);
  return statements;
}

function pushStatement(statements, statement) {
  const trimmed = statement.trim();
  if (trimmed) statements.push(trimmed);
}

function isMainModule(moduleUrl) {
  return process.argv[1] && pathToFileURL(process.argv[1]).href === moduleUrl;
}
