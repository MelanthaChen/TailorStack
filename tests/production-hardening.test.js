import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateConfig } from "../packages/config/src/index.js";
import { GenericJobFramework, InMemoryQueue } from "../packages/queue/src/index.js";
import { callApi, createTestApi } from "./helpers/api-test-helpers.js";

test("API responses use production success and failure envelopes", async () => {
  const { app } = createTestApi();
  const health = await callApi(app, { url: "/healthz" });
  const protectedResponse = await callApi(app, { url: "/v1/protected/status" });

  assert.equal(health.body.success, true);
  assert.equal(typeof health.body.requestId, "string");
  assert.equal(protectedResponse.body.success, false);
  assert.equal(protectedResponse.body.code, "unauthenticated");
  assert.equal(typeof protectedResponse.body.error, "string");
});

test("API adds security headers and rejects unsupported content types", async () => {
  const { app } = createTestApi();
  const response = await callApi(app, {
    method: "POST",
    url: "/v1/auth/login",
    body: { email: "a@example.com", password: "password123" },
    headers: { "content-type": "text/plain" }
  });

  assert.equal(response.statusCode, 415);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "DENY");
});

test("configuration validation rejects weak production secrets", () => {
  assert.throws(() => validateConfig({
    logLevel: "info",
    authRepositoryDriver: "postgres",
    objectStorageDriver: "filesystem",
    webOrigin: "https://tailorstack.example",
    databaseUrl: "postgres://user:pass@localhost:5432/tailorstack",
    appEnv: "production",
    nodeEnv: "production",
    sessionSecret: "change-me-in-local-development",
    objectStorageSecretAccessKey: "tailorstack-dev"
  }), /SESSION_SECRET/);
});

test("generic job framework standardizes lifecycle fields", async () => {
  const queue = new InMemoryQueue();
  const framework = new GenericJobFramework({
    queue,
    handlers: {
      render_resume: async () => ({ renderedResumeId: "rendered-1" })
    }
  });

  const queued = await framework.submit({ jobType: "render_resume", userId: "user-1" });
  const completed = await framework.run(queued.id, { requestId: "req-1" });

  assert.equal(queued.status, "queued");
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.resultRef.renderedResumeId, "rendered-1");
  assert.ok(completed.completedAt);
});

test("database access no longer shells out to psql", async () => {
  const sqlUtils = await readFile("apps/api/src/repositories/sql-utils.js", "utf8");
  const migrate = await readFile("scripts/dev/migrate.mjs", "utf8");
  assert.doesNotMatch(sqlUtils, /child_process|spawn|psql/);
  assert.doesNotMatch(migrate, /child_process|spawn|psql/);
});
