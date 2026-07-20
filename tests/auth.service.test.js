import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAuthRepository } from "../apps/api/src/repositories/auth.repository.js";
import { AuthService } from "../apps/api/src/services/auth.service.js";

function createService() {
  const repository = new InMemoryAuthRepository();
  const service = new AuthService({
    authRepository: repository,
    config: {
      sessionSecret: "test-secret",
      sessionTtlHours: 168
    },
    logger: {
      info() {}
    }
  });
  return { service, repository };
}

test("signup creates user, identity, and session", async () => {
  const { service, repository } = createService();
  const result = await service.signup({
    email: "User@Example.com",
    password: "password123",
    displayName: "Example User"
  }, { requestId: "req_1" });

  assert.equal(result.user.email, "user@example.com");
  assert.equal(result.user.displayName, "Example User");
  assert.equal(result.session.token.includes("."), true);

  const identity = await repository.findAuthIdentity("email", "user@example.com");
  assert.equal(identity.userId, result.user.id);
});

test("login rejects invalid password", async () => {
  const { service } = createService();
  await service.signup({
    email: "user@example.com",
    password: "password123"
  }, { requestId: "req_1" });

  await assert.rejects(() => service.login({
    email: "user@example.com",
    password: "wrong-password"
  }, { requestId: "req_2" }), /Invalid email or password/);
});

test("logout revokes the active session", async () => {
  const { service, repository } = createService();
  const { session } = await service.signup({
    email: "user@example.com",
    password: "password123"
  }, { requestId: "req_1" });

  await service.logout({
    requestId: "req_2",
    currentSession: session
  });

  const stored = await repository.findSessionById(session.id);
  assert.equal(Boolean(stored.revokedAt), true);
});
