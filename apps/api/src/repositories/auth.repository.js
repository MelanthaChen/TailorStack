import { queryJson, sql } from "./sql-utils.js";

export class InMemoryAuthRepository {
  constructor() {
    this.users = new Map();
    this.identities = new Map();
    this.sessions = new Map();
  }

  async createUser({ email, displayName }) {
    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email: normalizeEmail(email),
      displayName: displayName ?? "",
      status: "active",
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.users.set(user.id, user);
    return user;
  }

  async findUserById(id) {
    return this.users.get(id) ?? null;
  }

  async findUserByEmail(email) {
    const normalized = normalizeEmail(email);
    return [...this.users.values()].find((user) => user.email === normalized && !user.deletedAt) ?? null;
  }

  async createAuthIdentity({ userId, provider, providerSubject, passwordHash, email }) {
    const now = new Date().toISOString();
    const identity = {
      id: crypto.randomUUID(),
      userId,
      provider,
      providerSubject,
      passwordHash,
      email: normalizeEmail(email),
      createdAt: now,
      updatedAt: now
    };
    this.identities.set(identityKey(provider, providerSubject), identity);
    return identity;
  }

  async findAuthIdentity(provider, providerSubject) {
    return this.identities.get(identityKey(provider, providerSubject)) ?? null;
  }

  async createSession({ id, userId, expiresAt }) {
    const now = new Date().toISOString();
    const session = {
      id,
      userId,
      expiresAt,
      revokedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.sessions.set(id, session);
    return session;
  }

  async findSessionById(id) {
    return this.sessions.get(id) ?? null;
  }

  async revokeSession(id) {
    const session = this.sessions.get(id);
    if (!session) return null;
    const updated = {
      ...session,
      revokedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.sessions.set(id, updated);
    return updated;
  }
}

export class PostgresAuthRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createUser({ email, displayName }) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const rows = await this.queryJson(`
      INSERT INTO users (id, email, display_name, status, created_at, updated_at)
      VALUES (${sql(id)}, ${sql(normalizeEmail(email))}, ${sql(displayName ?? "")}, 'active', ${sql(now)}, ${sql(now)})
      RETURNING ${userJson()}
    `);
    return rows[0];
  }

  async findUserById(id) {
    const rows = await this.queryJson(`
      SELECT ${userJson()}
      FROM users
      WHERE id = ${sql(id)} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findUserByEmail(email) {
    const rows = await this.queryJson(`
      SELECT ${userJson()}
      FROM users
      WHERE email = ${sql(normalizeEmail(email))} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async createAuthIdentity({ userId, provider, providerSubject, passwordHash, email }) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const rows = await this.queryJson(`
      INSERT INTO auth_identities (id, user_id, provider, provider_subject, email, password_hash, created_at, updated_at)
      VALUES (${sql(id)}, ${sql(userId)}, ${sql(provider)}, ${sql(providerSubject)}, ${sql(normalizeEmail(email))}, ${sql(passwordHash)}, ${sql(now)}, ${sql(now)})
      RETURNING ${identityJson()}
    `);
    return rows[0];
  }

  async findAuthIdentity(provider, providerSubject) {
    const rows = await this.queryJson(`
      SELECT ${identityJson()}
      FROM auth_identities
      WHERE provider = ${sql(provider)} AND provider_subject = ${sql(providerSubject)}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async createSession({ id, userId, expiresAt }) {
    const now = new Date().toISOString();
    const rows = await this.queryJson(`
      INSERT INTO user_sessions (id, user_id, expires_at, created_at, updated_at)
      VALUES (${sql(id)}, ${sql(userId)}, ${sql(expiresAt)}, ${sql(now)}, ${sql(now)})
      RETURNING ${sessionJson()}
    `);
    return rows[0];
  }

  async findSessionById(id) {
    const rows = await this.queryJson(`
      SELECT ${sessionJson()}
      FROM user_sessions
      WHERE id = ${sql(id)}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async revokeSession(id) {
    const now = new Date().toISOString();
    const rows = await this.queryJson(`
      UPDATE user_sessions
      SET revoked_at = ${sql(now)}, updated_at = ${sql(now)}
      WHERE id = ${sql(id)}
      RETURNING ${sessionJson()}
    `);
    return rows[0] ?? null;
  }

  async queryJson(query) {
    return queryJson(this.databaseUrl, query);
  }
}

export function createAuthRepository(config) {
  if (config.authRepositoryDriver === "memory") {
    return new InMemoryAuthRepository();
  }
  return new PostgresAuthRepository({ databaseUrl: config.databaseUrl });
}

function identityKey(provider, providerSubject) {
  return `${provider}:${providerSubject}`;
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function userJson() {
  return `json_build_object(
    'id', id,
    'email', email,
    'displayName', display_name,
    'status', status,
    'createdAt', created_at,
    'updatedAt', updated_at,
    'deletedAt', deleted_at
  ) AS value`;
}

function identityJson() {
  return `json_build_object(
    'id', id,
    'userId', user_id,
    'provider', provider,
    'providerSubject', provider_subject,
    'email', email,
    'passwordHash', password_hash,
    'createdAt', created_at,
    'updatedAt', updated_at
  ) AS value`;
}

function sessionJson() {
  return `json_build_object(
    'id', id,
    'userId', user_id,
    'expiresAt', expires_at,
    'revokedAt', revoked_at,
    'createdAt', created_at,
    'updatedAt', updated_at
  ) AS value`;
}
