import { readdir, readFile } from "node:fs/promises";
import { loadConfig } from "../../packages/config/src/index.js";
import { closeDatabasePools, getDatabasePool } from "../../packages/database/src/index.js";

const config = loadConfig();
const pool = getDatabasePool(config);
const migrationDir = new URL("../../infra/migrations", import.meta.url);
const files = (await readdir(migrationDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No SQL migrations found. Migration framework is ready.");
  process.exit(0);
}

try {
  for (const file of files) {
    const sql = await readFile(new URL(file, migrationDir), "utf8");
    await pool.transaction(async (client) => {
      for (const statement of splitSqlStatements(sql)) {
        await client.query(statement);
      }
    });
    console.log(`Applied ${file}`);
  }
} finally {
  await closeDatabasePools();
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
