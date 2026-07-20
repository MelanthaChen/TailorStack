import { queryJson, sql } from "./sql-utils.js";

export class InMemoryAsyncJobRepository {
  constructor() {
    this.jobs = new Map();
  }

  async createJob(input) {
    const now = new Date().toISOString();
    const job = {
      id: crypto.randomUUID(),
      userId: input.userId ?? null,
      jobType: input.jobType,
      status: input.status ?? "queued",
      idempotencyKey: input.idempotencyKey ?? null,
      priority: input.priority ?? 100,
      payloadRef: input.payloadRef ?? {},
      resultRef: null,
      errorCode: null,
      errorMessage: null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 3,
      availableAt: input.availableAt ?? now,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async findJobById(id) {
    return this.jobs.get(id) ?? null;
  }

  async updateJobStatus(id, { status }) {
    const job = await this.findJobById(id);
    if (!job) return null;
    const now = new Date().toISOString();
    const updated = {
      ...job,
      status,
      startedAt: status === "running" ? now : job.startedAt,
      completedAt: ["succeeded", "failed", "canceled"].includes(status) ? now : job.completedAt,
      updatedAt: now
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async completeJob(id, { resultRef }) {
    const job = await this.findJobById(id);
    if (!job) return null;
    const now = new Date().toISOString();
    const updated = {
      ...job,
      status: "succeeded",
      resultRef: resultRef ?? {},
      completedAt: now,
      updatedAt: now
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async failJob(id, { errorCode, errorMessage }) {
    const job = await this.findJobById(id);
    if (!job) return null;
    const now = new Date().toISOString();
    const updated = {
      ...job,
      status: "failed",
      errorCode,
      errorMessage,
      attemptCount: job.attemptCount + 1,
      completedAt: now,
      updatedAt: now
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async retryJob(id) {
    const job = await this.findJobById(id);
    if (!job) return null;
    const updated = {
      ...job,
      status: "queued",
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      updatedAt: new Date().toISOString()
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async findJobForResume(resumeId, userId) {
    return [...this.jobs.values()].find((job) =>
      job.userId === userId &&
      job.jobType === "resume_parse" &&
      job.payloadRef?.resumeId === resumeId
    ) ?? null;
  }
}

export class PostgresAsyncJobRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createJob(input) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO async_jobs (
        id, user_id, job_type, status, idempotency_key, priority, payload_ref,
        result_ref, error_code, error_message, attempt_count, max_attempts,
        available_at, created_at, updated_at
      )
      VALUES (
        ${sql(id)}, ${sql(input.userId ?? null)}, ${sql(input.jobType)},
        ${sql(input.status ?? "queued")}, ${sql(input.idempotencyKey ?? null)},
        ${input.priority ?? 100}, ${sql(input.payloadRef ?? {})}::jsonb,
        NULL, NULL, NULL, 0, ${input.maxAttempts ?? 3},
        ${sql(input.availableAt ?? now)}, ${sql(now)}, ${sql(now)}
      )
      RETURNING ${jobJson()}
    `);
    return rows[0];
  }

  async findJobById(id) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${jobJson()}
      FROM async_jobs
      WHERE id = ${sql(id)}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async updateJobStatus(id, { status }) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      UPDATE async_jobs
      SET status = ${sql(status)},
          started_at = CASE WHEN ${sql(status)} = 'running' THEN ${sql(now)}::timestamptz ELSE started_at END,
          completed_at = CASE WHEN ${sql(status)} IN ('succeeded', 'failed', 'canceled') THEN ${sql(now)}::timestamptz ELSE completed_at END,
          updated_at = ${sql(now)}
      WHERE id = ${sql(id)}
      RETURNING ${jobJson()}
    `);
    return rows[0] ?? null;
  }

  async completeJob(id, { resultRef }) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      UPDATE async_jobs
      SET status = 'succeeded',
          result_ref = ${sql(resultRef ?? {})}::jsonb,
          completed_at = ${sql(now)},
          updated_at = ${sql(now)}
      WHERE id = ${sql(id)}
      RETURNING ${jobJson()}
    `);
    return rows[0] ?? null;
  }

  async failJob(id, { errorCode, errorMessage }) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      UPDATE async_jobs
      SET status = 'failed',
          error_code = ${sql(errorCode)},
          error_message = ${sql(errorMessage)},
          attempt_count = attempt_count + 1,
          completed_at = ${sql(now)},
          updated_at = ${sql(now)}
      WHERE id = ${sql(id)}
      RETURNING ${jobJson()}
    `);
    return rows[0] ?? null;
  }

  async retryJob(id) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      UPDATE async_jobs
      SET status = 'queued', error_code = NULL, error_message = NULL, completed_at = NULL, updated_at = ${sql(now)}
      WHERE id = ${sql(id)}
      RETURNING ${jobJson()}
    `);
    return rows[0] ?? null;
  }

  async findJobForResume(resumeId, userId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${jobJson()}
      FROM async_jobs
      WHERE user_id = ${sql(userId)}
        AND job_type = 'resume_parse'
        AND payload_ref ->> 'resumeId' = ${sql(resumeId)}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }
}

export function createAsyncJobRepository(config) {
  if (config.authRepositoryDriver === "memory") {
    return new InMemoryAsyncJobRepository();
  }
  return new PostgresAsyncJobRepository({ databaseUrl: config.databaseUrl });
}

function jobJson() {
  return `json_build_object(
    'id', id,
    'userId', user_id,
    'jobType', job_type,
    'status', status,
    'idempotencyKey', idempotency_key,
    'priority', priority,
    'payloadRef', payload_ref,
    'resultRef', result_ref,
    'errorCode', error_code,
    'errorMessage', error_message,
    'attemptCount', attempt_count,
    'maxAttempts', max_attempts,
    'availableAt', available_at,
    'startedAt', started_at,
    'completedAt', completed_at,
    'createdAt', created_at,
    'updatedAt', updated_at
  ) AS value`;
}
