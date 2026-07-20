import { queryJson, sql } from "./sql-utils.js";

export class InMemoryPromotionRepository {
  constructor({ resumeRepository, failAfterVersion = false } = {}) {
    this.resumeRepository = resumeRepository;
    this.versions = new Map();
    this.diffs = new Map();
    this.auditEvents = new Map();
    this.failAfterVersion = failAfterVersion;
  }

  async promoteDraft({ userId, resumeId, resumeTitle, requestId }) {
    const snapshot = {
      versions: new Map(this.versions),
      diffs: new Map(this.diffs),
      auditEvents: new Map(this.auditEvents),
      resumes: this.resumeRepository?.resumes ? new Map(this.resumeRepository.resumes) : null
    };

    try {
      const now = new Date().toISOString();
      const version = {
        id: crypto.randomUUID(),
        resumeId,
        userId,
        parentVersionId: null,
        versionType: "master",
        name: resumeTitle || "Master Resume",
        targetCompany: null,
        targetRole: null,
        jobDescriptionId: null,
        status: "ready",
        diffId: null,
        resolvedSchemaHash: null,
        metadata: {
          promotedFromDraft: true
        },
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };
      this.versions.set(version.id, version);

      if (this.failAfterVersion) {
        throw new Error("Injected promotion failure");
      }

      const diff = {
        id: crypto.randomUUID(),
        userId,
        resumeId,
        baseVersionId: version.id,
        sourceMatchResultId: null,
        operationCount: 0,
        operations: [],
        schemaVersion: 1,
        createdByUserId: userId,
        createdAt: now
      };
      this.diffs.set(diff.id, diff);
      version.diffId = diff.id;
      this.versions.set(version.id, version);

      const resume = await this.resumeRepository.activateResume(resumeId, userId, version.id);
      const auditEvent = {
        id: crypto.randomUUID(),
        userId,
        actorUserId: userId,
        eventType: "resume_promoted",
        resourceType: "resume",
        resourceId: resumeId,
        requestId,
        ipHash: null,
        userAgentHash: null,
        metadata: {
          versionId: version.id,
          diffId: diff.id
        },
        createdAt: now
      };
      this.auditEvents.set(auditEvent.id, auditEvent);

      return { resume, version, diff, auditEvent };
    } catch (error) {
      this.versions = snapshot.versions;
      this.diffs = snapshot.diffs;
      this.auditEvents = snapshot.auditEvents;
      if (snapshot.resumes) this.resumeRepository.resumes = snapshot.resumes;
      throw error;
    }
  }

  async findMasterVersionForResume(userId, resumeId) {
    return [...this.versions.values()].find((version) =>
      version.userId === userId &&
      version.resumeId === resumeId &&
      version.versionType === "master" &&
      !version.deletedAt
    ) ?? null;
  }

  async findDiffById(id) {
    return this.diffs.get(id) ?? null;
  }
}

export class PostgresPromotionRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async promoteDraft({ userId, resumeId, resumeTitle, requestId }) {
    const versionId = crypto.randomUUID();
    const diffId = crypto.randomUUID();
    const auditEventId = crypto.randomUUID();
    const now = new Date().toISOString();

    const rows = await queryJson(this.databaseUrl, `
      WITH inserted_version AS (
        INSERT INTO resume_versions (
          id, resume_id, user_id, parent_version_id, version_type, name,
          target_company, target_role, job_description_id, status, diff_id,
          resolved_schema_hash, metadata, created_by_user_id, created_at, updated_at
        )
        VALUES (
          ${sql(versionId)}, ${sql(resumeId)}, ${sql(userId)}, NULL, 'master',
          ${sql(resumeTitle || "Master Resume")}, NULL, NULL, NULL, 'ready', NULL,
          NULL, ${sql({ promotedFromDraft: true })}::jsonb, ${sql(userId)}, ${sql(now)}, ${sql(now)}
        )
        RETURNING *
      ),
      inserted_diff AS (
        INSERT INTO resume_diffs (
          id, user_id, resume_id, base_version_id, source_match_result_id,
          operation_count, operations, schema_version, created_by_user_id, created_at
        )
        VALUES (
          ${sql(diffId)}, ${sql(userId)}, ${sql(resumeId)}, ${sql(versionId)}, NULL,
          0, '[]'::jsonb, 1, ${sql(userId)}, ${sql(now)}
        )
        RETURNING *
      ),
      updated_version AS (
        UPDATE resume_versions
        SET diff_id = ${sql(diffId)}, updated_at = ${sql(now)}
        WHERE id = ${sql(versionId)}
        RETURNING *
      ),
      updated_resume AS (
        UPDATE resumes
        SET status = 'active', canonical_version_id = ${sql(versionId)}, updated_at = ${sql(now)}
        WHERE id = ${sql(resumeId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
        RETURNING *
      ),
      inserted_audit AS (
        INSERT INTO audit_events (
          id, user_id, actor_user_id, event_type, resource_type, resource_id,
          request_id, metadata, created_at
        )
        VALUES (
          ${sql(auditEventId)}, ${sql(userId)}, ${sql(userId)}, 'resume_promoted',
          'resume', ${sql(resumeId)}, ${sql(requestId)},
          ${sql({ versionId, diffId })}::jsonb, ${sql(now)}
        )
        RETURNING *
      )
      SELECT json_build_object(
        'resume', (SELECT ${resumeJsonValue()} FROM updated_resume),
        'version', (SELECT ${versionJsonValue()} FROM updated_version),
        'diff', (SELECT ${diffJsonValue()} FROM inserted_diff),
        'auditEvent', (SELECT ${auditJsonValue()} FROM inserted_audit)
      ) AS value
    `);
    return rows[0];
  }

  async findMasterVersionForResume(userId, resumeId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${versionJson()}
      FROM resume_versions
      WHERE user_id = ${sql(userId)}
        AND resume_id = ${sql(resumeId)}
        AND version_type = 'master'
        AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findDiffById(id) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${diffJson()}
      FROM resume_diffs
      WHERE id = ${sql(id)}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }
}

export function createPromotionRepository(config, dependencies = {}) {
  if (config.authRepositoryDriver === "memory") {
    return new InMemoryPromotionRepository(dependencies);
  }
  return new PostgresPromotionRepository({ databaseUrl: config.databaseUrl });
}

function resumeJsonValue() {
  return `json_build_object('id', id, 'userId', user_id, 'title', title, 'resumeType', resume_type, 'status', status, 'canonicalVersionId', canonical_version_id, 'sourceFileId', source_file_id, 'locale', locale, 'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at)`;
}

function versionJsonValue() {
  return `json_build_object('id', id, 'resumeId', resume_id, 'userId', user_id, 'parentVersionId', parent_version_id, 'versionType', version_type, 'name', name, 'targetCompany', target_company, 'targetRole', target_role, 'jobDescriptionId', job_description_id, 'status', status, 'diffId', diff_id, 'resolvedSchemaHash', resolved_schema_hash, 'metadata', metadata, 'createdByUserId', created_by_user_id, 'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at)`;
}

function diffJsonValue() {
  return `json_build_object('id', id, 'userId', user_id, 'resumeId', resume_id, 'baseVersionId', base_version_id, 'sourceMatchResultId', source_match_result_id, 'operationCount', operation_count, 'operations', operations, 'schemaVersion', schema_version, 'createdByUserId', created_by_user_id, 'createdAt', created_at)`;
}

function auditJsonValue() {
  return `json_build_object('id', id, 'userId', user_id, 'actorUserId', actor_user_id, 'eventType', event_type, 'resourceType', resource_type, 'resourceId', resource_id, 'requestId', request_id, 'metadata', metadata, 'createdAt', created_at)`;
}

function versionJson() {
  return `${versionJsonValue()} AS value`;
}

function diffJson() {
  return `${diffJsonValue()} AS value`;
}
