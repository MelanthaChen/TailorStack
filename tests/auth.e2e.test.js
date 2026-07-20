import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { callApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

test("end-to-end auth session persists until logout", async () => {
  const { app } = createTestApi();

  const signup = await callApi(app, {
    method: "POST",
    url: "/v1/auth/signup",
    body: {
      email: "e2e@example.com",
      password: "password123",
      displayName: "E2E User"
    }
  });
  const cookie = getSetCookie(signup);

  const firstRefresh = await callApi(app, {
    method: "GET",
    url: "/v1/auth/me",
    cookie
  });
  const secondRefresh = await callApi(app, {
    method: "GET",
    url: "/v1/auth/me",
    cookie
  });

  assert.equal(firstRefresh.statusCode, 200);
  assert.equal(secondRefresh.statusCode, 200);
  assert.equal(secondRefresh.body.data.user.email, "e2e@example.com");

  await callApi(app, {
    method: "POST",
    url: "/v1/auth/logout",
    cookie
  });

  const afterLogout = await callApi(app, {
    method: "GET",
    url: "/v1/auth/me",
    cookie
  });
  assert.equal(afterLogout.statusCode, 401);
});

test("frontend shell contains auth-only routes and unauthorized redirect logic", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");

  assert.match(appJs, /navigate\("\/login", true\)/);
  assert.match(appJs, /\/v1\/auth\/me/);
  assert.match(appJs, /\/v1\/auth\/login/);
  assert.match(appJs, /\/v1\/auth\/logout/);
  assert.doesNotMatch(appJs, /resume upload/i);
});
