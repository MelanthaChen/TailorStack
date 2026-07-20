import assert from "node:assert/strict";
import test from "node:test";
import { wrapJsonRowsQuery } from "../apps/api/src/repositories/sql-utils.js";

test("signup insert SQL is wrapped as a PostgreSQL data-modifying CTE", () => {
  const signupSql = `
    INSERT INTO users (id, email, display_name, status, created_at, updated_at)
    VALUES ('user-id', 'person@example.com', '', 'active', '2026-01-01', '2026-01-01')
    RETURNING json_build_object('id', id) AS value
  `;

  const wrapped = wrapJsonRowsQuery(signupSql);

  assert.match(wrapped, /^WITH result AS \(\s*INSERT INTO users/);
  assert.match(wrapped, /RETURNING json_build_object\('id', id\) AS value/);
  assert.match(wrapped, /SELECT COALESCE\(json_agg\(result\.value\), '\[\]'::json\) AS value FROM result$/);
  assert.doesNotMatch(wrapped, /FROM \(\s*INSERT INTO users/);
});

test("select SQL keeps derived-table JSON aggregation", () => {
  const wrapped = wrapJsonRowsQuery("SELECT json_build_object('id', id) AS value FROM users");

  assert.match(wrapped, /^SELECT COALESCE/);
  assert.match(wrapped, /FROM \(SELECT json_build_object/);
});
