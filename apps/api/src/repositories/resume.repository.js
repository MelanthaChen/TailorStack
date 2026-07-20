import { queryJson, sql } from "./sql-utils.js";

export class InMemoryResumeRepository {
  constructor() {
    this.resumes = new Map();
  }

  async createResume(input) {
    const now = new Date().toISOString();
    const resume = {
      id: crypto.randomUUID(),
      userId: input.userId,
      title: input.title,
      resumeType: input.resumeType ?? "master",
      status: input.status ?? "parsing",
      canonicalVersionId: null,
      sourceFileId: input.sourceFileId,
      locale: input.locale ?? null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.resumes.set(resume.id, resume);
    return resume;
  }

  async listResumesForUser(userId) {
    return [...this.resumes.values()]
      .filter((resume) => resume.userId === userId && !resume.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findResumeForUser(id, userId) {
    const resume = this.resumes.get(id);
    if (!resume || resume.userId !== userId || resume.deletedAt) return null;
    return resume;
  }

  async updateResumeStatus(id, userId, status) {
    const resume = await this.findResumeForUser(id, userId);
    if (!resume) return null;
    const updated = {
      ...resume,
      status,
      updatedAt: new Date().toISOString()
    };
    this.resumes.set(id, updated);
    return updated;
  }

  async activateResume(id, userId, canonicalVersionId) {
    const resume = await this.findResumeForUser(id, userId);
    if (!resume) return null;
    const updated = {
      ...resume,
      status: "active",
      canonicalVersionId,
      updatedAt: new Date().toISOString()
    };
    this.resumes.set(id, updated);
    return updated;
  }
}

export class PostgresResumeRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createResume(input) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO resumes (
        id, user_id, title, resume_type, status, source_file_id,
        locale, metadata, created_at, updated_at
      )
      VALUES (
        ${sql(id)}, ${sql(input.userId)}, ${sql(input.title)},
        ${sql(input.resumeType ?? "master")}, ${sql(input.status ?? "parsing")},
        ${sql(input.sourceFileId)}, ${sql(input.locale ?? null)},
        ${sql(input.metadata ?? {})}::jsonb, ${sql(now)}, ${sql(now)}
      )
      RETURNING ${resumeJson()}
    `);
    return rows[0];
  }

  async listResumesForUser(userId) {
    return queryJson(this.databaseUrl, `
      SELECT ${resumeJson()}
      FROM resumes
      WHERE user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY created_at DESC
    `);
  }

  async findResumeForUser(id, userId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${resumeJson()}
      FROM resumes
      WHERE id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async updateResumeStatus(id, userId, status) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      UPDATE resumes
      SET status = ${sql(status)}, updated_at = ${sql(now)}
      WHERE id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      RETURNING ${resumeJson()}
    `);
    return rows[0] ?? null;
  }

  async activateResume(id, userId, canonicalVersionId) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      UPDATE resumes
      SET status = 'active', canonical_version_id = ${sql(canonicalVersionId)}, updated_at = ${sql(now)}
      WHERE id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      RETURNING ${resumeJson()}
    `);
    return rows[0] ?? null;
  }
}

export function createResumeRepository(config) {
  if (config.authRepositoryDriver === "memory") {
    return new InMemoryResumeRepository();
  }
  return new PostgresResumeRepository({ databaseUrl: config.databaseUrl });
}

function resumeJson() {
  return `json_build_object(
    'id', id,
    'userId', user_id,
    'title', title,
    'resumeType', resume_type,
    'status', status,
    'canonicalVersionId', canonical_version_id,
    'sourceFileId', source_file_id,
    'locale', locale,
    'metadata', metadata,
    'createdAt', created_at,
    'updatedAt', updated_at,
    'deletedAt', deleted_at
  ) AS value`;
}
