import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  listMigrationSqlFiles,
  loadMigrationSql,
  migrationDirectoryUrl,
  resolveMigrationFileUrl,
  runMigrations
} from "../scripts/dev/migrate.mjs";

test("migration runner resolves and loads SQL files from infra/migrations", async () => {
  const migrationDir = migrationDirectoryUrl();
  assert.match(fileURLToPath(migrationDir), /infra[/\\]migrations[/\\]?$/);

  const expected = (await readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const actual = await listMigrationSqlFiles(migrationDir);

  assert.deepEqual(actual, expected);
  assert.ok(actual.includes("0002_authentication.sql"));

  for (const file of actual) {
    const resolved = resolveMigrationFileUrl(file, migrationDir);
    assert.match(fileURLToPath(resolved), /infra[/\\]migrations[/\\].+\.sql$/);
    const sql = await loadMigrationSql(file, migrationDir);
    assert.equal(sql.length > 0, true);
  }
});

test("runMigrations applies every discovered SQL file through the migration API", async () => {
  const migrationDir = migrationDirectoryUrl();
  const expected = await listMigrationSqlFiles(migrationDir);
  const executed = [];
  const pool = {
    async transaction(callback) {
      await callback({
        async query(statement) {
          executed.push(statement);
        }
      });
    }
  };

  const result = await runMigrations({
    pool,
    migrationDir,
    logger: { log() {} }
  });

  assert.deepEqual(result.applied, expected);
  assert.equal(result.applied.length > 0, true);
  assert.equal(executed.length > 0, true);
});
