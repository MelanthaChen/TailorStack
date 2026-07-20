import { queryJson, sql } from "./sql-utils.js";

export class InMemoryJobKeywordRepository {
  constructor() {
    this.keywords = new Map();
  }

  async createMany({ userId, jobDescriptionId, keywords }) {
    const now = new Date().toISOString();
    const created = keywords.map((input) => ({
      id: crypto.randomUUID(),
      userId,
      jobDescriptionId,
      keyword: input.keyword,
      normalizedKeyword: input.normalizedKeyword,
      importance: input.importance,
      weight: input.weight,
      source: input.source,
      confidence: input.confidence,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }));
    created.forEach((keyword) => this.keywords.set(keyword.id, keyword));
    return created;
  }

  async listForJob(jobDescriptionId, userId) {
    return [...this.keywords.values()]
      .filter((keyword) => keyword.jobDescriptionId === jobDescriptionId && keyword.userId === userId && !keyword.deletedAt)
      .sort((a, b) => a.normalizedKeyword.localeCompare(b.normalizedKeyword));
  }
}

export class PostgresJobKeywordRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createMany({ userId, jobDescriptionId, keywords }) {
    const created = [];
    const now = new Date().toISOString();
    for (const input of keywords) {
      const rows = await queryJson(this.databaseUrl, `
        INSERT INTO job_keywords (
          id, user_id, job_description_id, keyword, normalized_keyword, importance,
          weight, source, confidence, metadata, created_at, updated_at
        )
        VALUES (
          ${sql(crypto.randomUUID())}, ${sql(userId)}, ${sql(jobDescriptionId)},
          ${sql(input.keyword)}, ${sql(input.normalizedKeyword)}, ${sql(input.importance)},
          ${input.weight}, ${sql(input.source)}, ${input.confidence}, ${sql(input.metadata ?? {})}::jsonb,
          ${sql(now)}, ${sql(now)}
        )
        RETURNING ${keywordJson()}
      `);
      created.push(rows[0]);
    }
    return created;
  }

  async listForJob(jobDescriptionId, userId) {
    return queryJson(this.databaseUrl, `
      SELECT ${keywordJson()}
      FROM job_keywords
      WHERE job_description_id = ${sql(jobDescriptionId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY normalized_keyword
    `);
  }
}

export function createJobKeywordRepository(config) {
  if (config.authRepositoryDriver === "memory") return new InMemoryJobKeywordRepository();
  return new PostgresJobKeywordRepository({ databaseUrl: config.databaseUrl });
}

function keywordJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'jobDescriptionId', job_description_id,
    'keyword', keyword, 'normalizedKeyword', normalized_keyword,
    'importance', importance, 'weight', weight, 'source', source,
    'confidence', confidence, 'metadata', metadata, 'createdAt', created_at,
    'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}
