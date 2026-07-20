import assert from "node:assert/strict";
import test from "node:test";
import { callApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

test("signup returns current user and session cookie", async () => {
  const { app } = createTestApi();

  const response = await callApi(app, {
    method: "POST",
    url: "/v1/auth/signup",
    body: {
      email: "user@example.com",
      password: "password123",
      displayName: "Example User"
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.user.email, "user@example.com");
  assert.match(getSetCookie(response), /tailorstack_session=/);
});

test("current user rejects missing session", async () => {
  const { app } = createTestApi();

  const response = await callApi(app, {
    method: "GET",
    url: "/v1/auth/me"
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, "unauthenticated");
});

test("login, current user, and logout work together", async () => {
  const { app } = createTestApi();

  await callApi(app, {
    method: "POST",
    url: "/v1/auth/signup",
    body: {
      email: "user@example.com",
      password: "password123"
    }
  });

  const login = await callApi(app, {
    method: "POST",
    url: "/v1/auth/login",
    body: {
      email: "user@example.com",
      password: "password123"
    }
  });
  const cookie = getSetCookie(login);

  const me = await callApi(app, {
    method: "GET",
    url: "/v1/auth/me",
    cookie
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.body.data.user.email, "user@example.com");

  const logout = await callApi(app, {
    method: "POST",
    url: "/v1/auth/logout",
    cookie
  });
  assert.equal(logout.statusCode, 200);

  const afterLogout = await callApi(app, {
    method: "GET",
    url: "/v1/auth/me",
    cookie
  });
  assert.equal(afterLogout.statusCode, 401);
});

test("protected endpoint rejects unauthorized requests", async () => {
  const { app } = createTestApi();

  const response = await callApi(app, {
    method: "GET",
    url: "/v1/protected/status"
  });

  assert.equal(response.statusCode, 401);
});
