import assert from "node:assert/strict";
import test from "node:test";
import { requireAuth, requireOwnership } from "../apps/api/src/middleware/auth.js";

test("requireAuth rejects unauthenticated context", () => {
  assert.throws(() => requireAuth({}), /Authentication is required/);
});

test("requireAuth returns current user", () => {
  const user = { id: "user_1" };
  assert.equal(requireAuth({ currentUser: user }), user);
});

test("requireOwnership allows owned resource", () => {
  const result = requireOwnership({
    currentUser: { id: "user_1" }
  }, {
    userId: "user_1"
  });
  assert.equal(result, true);
});

test("requireOwnership rejects another user's resource", () => {
  assert.throws(() => requireOwnership({
    currentUser: { id: "user_1" }
  }, {
    userId: "user_2"
  }), /You do not have access/);
});
