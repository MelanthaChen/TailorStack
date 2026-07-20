import { queryJson, sql } from "./sql-utils.js";

export class InMemoryJobRequirementRepository {
  constructor() {
    this.requirements = new Map();
  }

  async createMany({ userId, jobDescriptionId, requirements }) {
    const now = new Date().toISOString();
    const created = requirements.map((input) => ({
      id: crypto.randomUUID(),
      userId,
      jobDescriptionId,
      requirementType: input.type,
      text: input.text,
      normalizedText: input.normalizedText,
      importance: input.importance,
      weight: input.weight,
      category: input.category,
      sourceSpan: input.sourceSpan,
      confidence: input.confidence,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }));
    created.forEach((requirement) => this.requirements.set(requirement.id, requirement));
    return created;
  }

  async listForJob(jobDescriptionId, userId) {
    return [...this.requirements.values()]
      .filter((requirement) => requirement.jobDescriptionId === jobDescriptionId && requirement.userId === userId && !requirement.deletedAt)
      .sort((a, b) => importanceSort(a.importance) - importanceSort(b.importance));
  }
}

export class PostgresJobRequirementRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createMany({ userId, jobDescriptionId, requirements }) {
    const created = [];
    const now = new Date().toISOString();
    for (const input of requirements) {
      const rows = await queryJson(this.databaseUrl, `
        INSERT INTO job_requirements (
          id, user_id, job_description_id, requirement_type, text, normalized_text,
          importance, weight, category, source_span, confidence, metadata,
          created_at, updated_at
        )
        VALUES (
          ${sql(crypto.randomUUID())}, ${sql(userId)}, ${sql(jobDescriptionId)},
          ${sql(input.type)}, ${sql(input.text)}, ${sql(input.normalizedText)},
          ${sql(input.importance)}, ${input.weight}, ${sql(input.category)},
          ${sql(input.sourceSpan)}::jsonb, ${input.confidence}, ${sql(input.metadata ?? {})}::jsonb,
          ${sql(now)}, ${sql(now)}
        )
        RETURNING ${requirementJson()}
      `);
      created.push(rows[0]);
    }
    return created;
  }

  async listForJob(jobDescriptionId, userId) {
    return queryJson(this.databaseUrl, `
      SELECT ${requirementJson()}
      FROM job_requirements
      WHERE job_description_id = ${sql(jobDescriptionId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY CASE importance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at
    `);
  }
}

export function createJobRequirementRepository(config) {
  if (config.authRepositoryDriver === "memory") return new InMemoryJobRequirementRepository();
  return new PostgresJobRequirementRepository({ databaseUrl: config.databaseUrl });
}

function importanceSort(importance) {
  if (importance === "high") return 1;
  if (importance === "medium") return 2;
  return 3;
}

function requirementJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'jobDescriptionId', job_description_id,
    'requirementType', requirement_type, 'text', text, 'normalizedText', normalized_text,
    'importance', importance, 'weight', weight, 'category', category,
    'sourceSpan', source_span, 'confidence', confidence, 'metadata', metadata,
    'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}
