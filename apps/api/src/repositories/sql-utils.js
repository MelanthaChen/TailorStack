import { getDatabasePool, sqlLiteral } from "../../../../packages/database/src/index.js";

const poolByUrl = new Map();

export function sql(value) {
  return sqlLiteral(value);
}

export async function queryJson(databaseUrl, query, options = {}) {
  const pool = poolForUrl(databaseUrl, options.config);
  const wrapped = wrapJsonRowsQuery(query);
  const result = await pool.query(wrapped, [], { timeoutMs: options.timeoutMs });
  return result.rows[0]?.value ?? [];
}

export function wrapJsonRowsQuery(query) {
  const normalized = query.trim().replace(/;+\s*$/, "");
  if (isDirectDataMutation(normalized)) {
    return `WITH result AS (${normalized}) SELECT COALESCE(json_agg(result.value), '[]'::json) AS value FROM result`;
  }
  return `SELECT COALESCE(json_agg(result.value), '[]'::json) AS value FROM (${normalized}) result`;
}

export async function executeSql(databaseUrl, statement, options = {}) {
  const pool = poolForUrl(databaseUrl, options.config);
  return pool.query(statement, [], { timeoutMs: options.timeoutMs });
}

export async function withTransaction(databaseUrl, callback, options = {}) {
  const pool = poolForUrl(databaseUrl, options.config);
  return pool.transaction(callback);
}

export async function databaseHealthCheck(databaseUrl, options = {}) {
  const pool = poolForUrl(databaseUrl, options.config);
  return pool.healthCheck();
}

function poolForUrl(databaseUrl, config = {}) {
  if (!poolByUrl.has(databaseUrl)) {
    poolByUrl.set(databaseUrl, getDatabasePool({ ...config, databaseUrl }));
  }
  return poolByUrl.get(databaseUrl);
}

function isDirectDataMutation(query) {
  return /^(INSERT|UPDATE|DELETE)\b/i.test(query);
}
