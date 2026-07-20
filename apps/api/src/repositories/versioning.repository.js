import { queryJson, sql } from "./sql-utils.js";

export class InMemoryVersioningRepository {
  constructor({ promotionRepository }) {
    this.promotionRepository = promotionRepository;
    this.snapshots = new Map();
    this.renderJobs = new Map();
    this.renderedResumes = new Map();
  }

  async createVersionWithSnapshot(input) {
    const now = new Date().toISOString();
    const versionNumber = await this.nextVersionNumber(input.userId, input.resumeId);
    const version = {
      id: crypto.randomUUID(),
      resumeId: input.resumeId,
      userId: input.userId,
      parentVersionId: input.parentVersionId,
      versionType: "optimized",
      name: `Version ${versionNumber}`,
      targetCompany: null,
      targetRole: null,
      jobDescriptionId: null,
      status: "ready",
      diffId: null,
      resolvedSchemaHash: input.snapshotHash,
      metadata: {
        versionNumber,
        appliedPatchSetId: input.patchSetId,
        snapshotHash: input.snapshotHash
      },
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.promotionRepository.versions.set(version.id, version);
    const diff = {
      id: crypto.randomUUID(),
      userId: input.userId,
      resumeId: input.resumeId,
      baseVersionId: version.id,
      sourceMatchResultId: input.matchReportId,
      operationCount: input.operations.length,
      operations: input.operations,
      schemaVersion: 1,
      createdByUserId: input.userId,
      createdAt: now
    };
    this.promotionRepository.diffs.set(diff.id, diff);
    version.diffId = diff.id;
    this.promotionRepository.versions.set(version.id, version);
    const snapshotRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      resumeId: input.resumeId,
      versionId: version.id,
      patchSetId: input.patchSetId,
      snapshotHash: input.snapshotHash,
      snapshot: input.snapshot,
      createdAt: now,
      deletedAt: null
    };
    this.snapshots.set(snapshotRecord.id, snapshotRecord);
    return { version, diff, snapshot: snapshotRecord };
  }

  async createRenderJob(input) {
    const now = new Date().toISOString();
    const job = {
      id: crypto.randomUUID(),
      userId: input.userId,
      resumeId: input.resumeId,
      versionId: input.versionId,
      format: input.format,
      status: "queued",
      resultRenderedResumeId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      deletedAt: null
    };
    this.renderJobs.set(job.id, job);
    return job;
  }

  async completeRenderJob(input) {
    const now = new Date().toISOString();
    const artifact = {
      id: crypto.randomUUID(),
      userId: input.userId,
      resumeId: input.resumeId,
      versionId: input.versionId,
      renderJobId: input.renderJobId,
      format: input.format,
      contentType: input.contentType,
      content: input.content,
      byteSize: Buffer.byteLength(input.content),
      createdAt: now,
      deletedAt: null
    };
    this.renderedResumes.set(artifact.id, artifact);
    const job = this.renderJobs.get(input.renderJobId);
    const updated = { ...job, status: "succeeded", resultRenderedResumeId: artifact.id, updatedAt: now, completedAt: now };
    this.renderJobs.set(job.id, updated);
    return { job: updated, artifact };
  }

  async listVersionsForResume(userId, resumeId) {
    return [...this.promotionRepository.versions.values()]
      .filter((version) => version.userId === userId && version.resumeId === resumeId && !version.deletedAt)
      .sort((a, b) => (a.metadata?.versionNumber ?? 1) - (b.metadata?.versionNumber ?? 1));
  }

  async findVersionForUser(userId, versionId) {
    return [...this.promotionRepository.versions.values()].find((version) => version.userId === userId && version.id === versionId && !version.deletedAt) ?? null;
  }

  async findSnapshotForVersion(userId, versionId) {
    return [...this.snapshots.values()].find((snapshot) => snapshot.userId === userId && snapshot.versionId === versionId && !snapshot.deletedAt) ?? null;
  }

  async findDiffForVersion(userId, versionId) {
    return [...this.promotionRepository.diffs.values()].find((diff) => diff.userId === userId && diff.baseVersionId === versionId) ?? null;
  }

  async listRenderedForVersion(userId, versionId) {
    return [...this.renderedResumes.values()].filter((artifact) => artifact.userId === userId && artifact.versionId === versionId && !artifact.deletedAt);
  }

  async findRenderedForUser(userId, renderedResumeId) {
    return this.renderedResumes.get(renderedResumeId)?.userId === userId ? this.renderedResumes.get(renderedResumeId) : null;
  }

  async nextVersionNumber(userId, resumeId) {
    const versions = await this.listVersionsForResume(userId, resumeId);
    return Math.max(0, ...versions.map((version) => version.metadata?.versionNumber ?? 1)) + 1;
  }
}

export class PostgresVersioningRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createVersionWithSnapshot(input) {
    const now = new Date().toISOString();
    const versionNumber = await this.nextVersionNumber(input.userId, input.resumeId);
    const versionId = crypto.randomUUID();
    const diffId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const metadata = { versionNumber, appliedPatchSetId: input.patchSetId, snapshotHash: input.snapshotHash };
    const rows = await queryJson(this.databaseUrl, `
      WITH inserted_version AS (
        INSERT INTO resume_versions (
          id, resume_id, user_id, parent_version_id, version_type, name,
          target_company, target_role, job_description_id, status, diff_id,
          resolved_schema_hash, metadata, created_by_user_id, created_at, updated_at
        )
        VALUES (
          ${sql(versionId)}, ${sql(input.resumeId)}, ${sql(input.userId)}, ${sql(input.parentVersionId)},
          'optimized', ${sql(`Version ${versionNumber}`)}, NULL, NULL, NULL, 'ready', NULL,
          ${sql(input.snapshotHash)}, ${sql(metadata)}::jsonb, ${sql(input.userId)}, ${sql(now)}, ${sql(now)}
        )
        RETURNING *
      ),
      inserted_diff AS (
        INSERT INTO resume_diffs (
          id, user_id, resume_id, base_version_id, source_match_result_id,
          operation_count, operations, schema_version, created_by_user_id, created_at
        )
        VALUES (
          ${sql(diffId)}, ${sql(input.userId)}, ${sql(input.resumeId)}, ${sql(versionId)},
          ${sql(input.matchReportId)}, ${input.operations.length}, ${sql(input.operations)}::jsonb,
          1, ${sql(input.userId)}, ${sql(now)}
        )
        RETURNING *
      ),
      updated_version AS (
        UPDATE resume_versions SET diff_id = ${sql(diffId)}, updated_at = ${sql(now)}
        WHERE id = ${sql(versionId)}
        RETURNING *
      ),
      inserted_snapshot AS (
        INSERT INTO version_snapshots (
          id, user_id, resume_id, version_id, patch_set_id, snapshot_hash,
          snapshot, created_at
        )
        VALUES (
          ${sql(snapshotId)}, ${sql(input.userId)}, ${sql(input.resumeId)}, ${sql(versionId)},
          ${sql(input.patchSetId)}, ${sql(input.snapshotHash)}, ${sql(input.snapshot)}::jsonb,
          ${sql(now)}
        )
        RETURNING *
      )
      SELECT json_build_object(
        'version', (SELECT ${versionJsonValue()} FROM updated_version),
        'diff', (SELECT ${diffJsonValue()} FROM inserted_diff),
        'snapshot', (SELECT ${snapshotJsonValue()} FROM inserted_snapshot)
      ) AS value
    `);
    return rows[0];
  }

  async createRenderJob(input) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO render_jobs (
        id, user_id, resume_id, version_id, format, status, result_rendered_resume_id,
        error_message, created_at, updated_at
      )
      VALUES (
        ${sql(crypto.randomUUID())}, ${sql(input.userId)}, ${sql(input.resumeId)},
        ${sql(input.versionId)}, ${sql(input.format)}, 'queued', NULL, NULL,
        ${sql(now)}, ${sql(now)}
      )
      RETURNING ${renderJobJson()}
    `);
    return rows[0];
  }

  async completeRenderJob(input) {
    const now = new Date().toISOString();
    const artifactId = crypto.randomUUID();
    const rows = await queryJson(this.databaseUrl, `
      WITH inserted_artifact AS (
        INSERT INTO rendered_resumes (
          id, user_id, resume_id, version_id, render_job_id, format, content_type,
          content, byte_size, created_at
        )
        VALUES (
          ${sql(artifactId)}, ${sql(input.userId)}, ${sql(input.resumeId)}, ${sql(input.versionId)},
          ${sql(input.renderJobId)}, ${sql(input.format)}, ${sql(input.contentType)},
          ${sql(input.content)}, ${Buffer.byteLength(input.content)}, ${sql(now)}
        )
        RETURNING *
      ),
      updated_job AS (
        UPDATE render_jobs
        SET status = 'succeeded', result_rendered_resume_id = ${sql(artifactId)},
            completed_at = ${sql(now)}, updated_at = ${sql(now)}
        WHERE id = ${sql(input.renderJobId)}
        RETURNING *
      )
      SELECT json_build_object(
        'job', (SELECT ${renderJobJsonValue()} FROM updated_job),
        'artifact', (SELECT ${renderedJsonValue()} FROM inserted_artifact)
      ) AS value
    `);
    return rows[0];
  }

  async listVersionsForResume(userId, resumeId) {
    return queryJson(this.databaseUrl, `
      SELECT ${versionJson()}
      FROM resume_versions
      WHERE user_id = ${sql(userId)} AND resume_id = ${sql(resumeId)} AND deleted_at IS NULL
      ORDER BY COALESCE((metadata ->> 'versionNumber')::integer, 1), created_at
    `);
  }

  async findVersionForUser(userId, versionId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${versionJson()}
      FROM resume_versions
      WHERE id = ${sql(versionId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findSnapshotForVersion(userId, versionId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${snapshotJson()}
      FROM version_snapshots
      WHERE user_id = ${sql(userId)} AND version_id = ${sql(versionId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findDiffForVersion(userId, versionId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${diffJson()}
      FROM resume_diffs
      WHERE user_id = ${sql(userId)} AND base_version_id = ${sql(versionId)}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async listRenderedForVersion(userId, versionId) {
    return queryJson(this.databaseUrl, `
      SELECT ${renderedJson()}
      FROM rendered_resumes
      WHERE user_id = ${sql(userId)} AND version_id = ${sql(versionId)} AND deleted_at IS NULL
      ORDER BY format
    `);
  }

  async findRenderedForUser(userId, renderedResumeId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${renderedJson()}
      FROM rendered_resumes
      WHERE id = ${sql(renderedResumeId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async nextVersionNumber(userId, resumeId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT json_build_object('next', COALESCE(MAX((metadata ->> 'versionNumber')::integer), 1) + 1) AS value
      FROM resume_versions
      WHERE user_id = ${sql(userId)} AND resume_id = ${sql(resumeId)} AND deleted_at IS NULL
    `);
    return rows[0]?.next ?? 2;
  }
}

export function createVersioningRepository(config, dependencies = {}) {
  if (config.authRepositoryDriver === "memory") return new InMemoryVersioningRepository(dependencies);
  return new PostgresVersioningRepository({ databaseUrl: config.databaseUrl });
}

function versionJsonValue() {
  return `json_build_object('id', id, 'resumeId', resume_id, 'userId', user_id, 'parentVersionId', parent_version_id, 'versionType', version_type, 'name', name, 'targetCompany', target_company, 'targetRole', target_role, 'jobDescriptionId', job_description_id, 'status', status, 'diffId', diff_id, 'resolvedSchemaHash', resolved_schema_hash, 'metadata', metadata, 'createdByUserId', created_by_user_id, 'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at)`;
}

function diffJsonValue() {
  return `json_build_object('id', id, 'userId', user_id, 'resumeId', resume_id, 'baseVersionId', base_version_id, 'sourceMatchResultId', source_match_result_id, 'operationCount', operation_count, 'operations', operations, 'schemaVersion', schema_version, 'createdByUserId', created_by_user_id, 'createdAt', created_at)`;
}

function snapshotJsonValue() {
  return `json_build_object('id', id, 'userId', user_id, 'resumeId', resume_id, 'versionId', version_id, 'patchSetId', patch_set_id, 'snapshotHash', snapshot_hash, 'snapshot', snapshot, 'createdAt', created_at, 'deletedAt', deleted_at)`;
}

function renderJobJsonValue() {
  return `json_build_object('id', id, 'userId', user_id, 'resumeId', resume_id, 'versionId', version_id, 'format', format, 'status', status, 'resultRenderedResumeId', result_rendered_resume_id, 'errorMessage', error_message, 'createdAt', created_at, 'updatedAt', updated_at, 'completedAt', completed_at, 'deletedAt', deleted_at)`;
}

function renderedJsonValue() {
  return `json_build_object('id', id, 'userId', user_id, 'resumeId', resume_id, 'versionId', version_id, 'renderJobId', render_job_id, 'format', format, 'contentType', content_type, 'content', content, 'byteSize', byte_size, 'createdAt', created_at, 'deletedAt', deleted_at)`;
}

function versionJson() {
  return `${versionJsonValue()} AS value`;
}

function diffJson() {
  return `${diffJsonValue()} AS value`;
}

function snapshotJson() {
  return `${snapshotJsonValue()} AS value`;
}

function renderJobJson() {
  return `${renderJobJsonValue()} AS value`;
}

function renderedJson() {
  return `${renderedJsonValue()} AS value`;
}
