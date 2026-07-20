import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../apps/api/src/app.js";

test("GET /healthz returns healthy response", async () => {
  const handleRequest = createApp({
    config: {
      appEnv: "test",
      logLevel: "error"
    },
    logger: {
      info() {},
      error() {}
    }
  });

  const response = createMockResponse();
  await handleRequest({
    method: "GET",
    url: "/healthz",
    headers: {}
  }, response);

  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.data.status, "ok");
  assert.equal(body.data.service, "tailorstack-api");
  assert.equal(body.data.environment, "test");
  assert.equal(body.success, true);
  assert.equal(body.requestId.length > 0, true);
});

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    }
  };
}
