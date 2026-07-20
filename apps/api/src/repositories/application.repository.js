import { queryJson, sql } from "./sql-utils.js";

export const applicationStatuses = Object.freeze([
  "draft",
  "preparing",
  "applied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "archived"
]);

export class InMemoryApplicationRepository {
  constructor() {
    this.applications = new Map();
    this.events = new Map();
    this.notes = new Map();
  }

  async createApplication(input) {
    const now = new Date().toISOString();
    const application = {
      id: crypto.randomUUID(),
      userId: input.userId,
      company: input.company,
      position: input.position ?? null,
      jobDescriptionId: input.jobDescriptionId ?? null,
      resumeVersionId: input.resumeVersionId,
      matchReportId: input.matchReportId ?? null,
      readinessReportId: input.readinessReportId ?? null,
      optimizationPatchSetId: input.optimizationPatchSetId ?? null,
      renderedResumeId: input.renderedResumeId ?? null,
      status: input.status ?? "draft",
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.applications.set(application.id, application);
    await this.createEvent({
      userId: input.userId,
      applicationId: application.id,
      eventType: "application_created",
      title: "Application created",
      artifactRefs: artifactRefs(application),
      metadata: {}
    });
    for (const event of initialArtifactEvents(application)) {
      await this.createEvent({
        userId: input.userId,
        applicationId: application.id,
        ...event
      });
    }
    return application;
  }

  async listApplications(userId) {
    return [...this.applications.values()]
      .filter((application) => application.userId === userId && !application.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findApplicationForUser(userId, applicationId) {
    const application = this.applications.get(applicationId);
    if (!application || application.userId !== userId || application.deletedAt) return null;
    return application;
  }

  async updateStatus({ userId, applicationId, status }) {
    const application = await this.findApplicationForUser(userId, applicationId);
    if (!application) return null;
    const updated = { ...application, status, updatedAt: new Date().toISOString() };
    this.applications.set(applicationId, updated);
    return updated;
  }

  async createEvent(input) {
    const event = {
      id: crypto.randomUUID(),
      userId: input.userId,
      applicationId: input.applicationId,
      eventType: input.eventType,
      title: input.title,
      body: input.body ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      artifactRefs: input.artifactRefs ?? {},
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
      deletedAt: null
    };
    this.events.set(event.id, event);
    return event;
  }

  async listEvents(userId, applicationId) {
    return [...this.events.values()]
      .filter((event) => event.userId === userId && event.applicationId === applicationId && !event.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createNote(input) {
    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(),
      userId: input.userId,
      applicationId: input.applicationId,
      body: input.body,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.notes.set(note.id, note);
    return note;
  }

  async listNotes(userId, applicationId) {
    return [...this.notes.values()]
      .filter((note) => note.userId === userId && note.applicationId === applicationId && !note.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class PostgresApplicationRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createApplication(input) {
    const now = new Date().toISOString();
    const applicationId = crypto.randomUUID();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO applications (
        id, user_id, company, position, job_description_id, resume_version_id,
        match_report_id, readiness_report_id, optimization_patch_set_id,
        rendered_resume_id, status, metadata, created_at, updated_at
      )
      VALUES (
        ${sql(applicationId)}, ${sql(input.userId)}, ${sql(input.company)}, ${sql(input.position ?? null)},
        ${sql(input.jobDescriptionId ?? null)}, ${sql(input.resumeVersionId)}, ${sql(input.matchReportId ?? null)},
        ${sql(input.readinessReportId ?? null)}, ${sql(input.optimizationPatchSetId ?? null)},
        ${sql(input.renderedResumeId ?? null)}, ${sql(input.status ?? "draft")}, ${sql(input.metadata ?? {})}::jsonb,
        ${sql(now)}, ${sql(now)}
      )
      RETURNING ${applicationJson()}
    `);
    const application = rows[0];
    await this.createEvent({
      userId: input.userId,
      applicationId,
      eventType: "application_created",
      title: "Application created",
      artifactRefs: artifactRefs(application),
      metadata: {}
    });
    for (const event of initialArtifactEvents(application)) {
      await this.createEvent({ userId: input.userId, applicationId, ...event });
    }
    return application;
  }

  async listApplications(userId) {
    return queryJson(this.databaseUrl, `
      SELECT ${applicationJson()}
      FROM applications
      WHERE user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY updated_at DESC
    `);
  }

  async findApplicationForUser(userId, applicationId) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${applicationJson()}
      FROM applications
      WHERE id = ${sql(applicationId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async updateStatus({ userId, applicationId, status }) {
    const rows = await queryJson(this.databaseUrl, `
      UPDATE applications
      SET status = ${sql(status)}, updated_at = ${sql(new Date().toISOString())}
      WHERE id = ${sql(applicationId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      RETURNING ${applicationJson()}
    `);
    return rows[0] ?? null;
  }

  async createEvent(input) {
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO application_events (
        id, user_id, application_id, event_type, title, body, from_status,
        to_status, artifact_refs, metadata, created_at
      )
      VALUES (
        ${sql(crypto.randomUUID())}, ${sql(input.userId)}, ${sql(input.applicationId)},
        ${sql(input.eventType)}, ${sql(input.title)}, ${sql(input.body ?? null)},
        ${sql(input.fromStatus ?? null)}, ${sql(input.toStatus ?? null)},
        ${sql(input.artifactRefs ?? {})}::jsonb, ${sql(input.metadata ?? {})}::jsonb,
        ${sql(new Date().toISOString())}
      )
      RETURNING ${eventJson()}
    `);
    return rows[0];
  }

  async listEvents(userId, applicationId) {
    return queryJson(this.databaseUrl, `
      SELECT ${eventJson()}
      FROM application_events
      WHERE user_id = ${sql(userId)} AND application_id = ${sql(applicationId)} AND deleted_at IS NULL
      ORDER BY created_at
    `);
  }

  async createNote(input) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO application_notes (
        id, user_id, application_id, body, created_at, updated_at
      )
      VALUES (
        ${sql(crypto.randomUUID())}, ${sql(input.userId)}, ${sql(input.applicationId)},
        ${sql(input.body)}, ${sql(now)}, ${sql(now)}
      )
      RETURNING ${noteJson()}
    `);
    return rows[0];
  }

  async listNotes(userId, applicationId) {
    return queryJson(this.databaseUrl, `
      SELECT ${noteJson()}
      FROM application_notes
      WHERE user_id = ${sql(userId)} AND application_id = ${sql(applicationId)} AND deleted_at IS NULL
      ORDER BY created_at DESC
    `);
  }
}

export function createApplicationRepository(config) {
  if (config.authRepositoryDriver === "memory") return new InMemoryApplicationRepository();
  return new PostgresApplicationRepository({ databaseUrl: config.databaseUrl });
}

function artifactRefs(application) {
  return {
    resumeVersionId: application.resumeVersionId,
    jobDescriptionId: application.jobDescriptionId,
    matchReportId: application.matchReportId,
    readinessReportId: application.readinessReportId,
    optimizationPatchSetId: application.optimizationPatchSetId,
    renderedResumeId: application.renderedResumeId
  };
}

function initialArtifactEvents(application) {
  return [
    {
      eventType: "resume_version_attached",
      title: "Resume version attached",
      artifactRefs: { resumeVersionId: application.resumeVersionId },
      metadata: {}
    },
    application.readinessReportId ? {
      eventType: "readiness_generated",
      title: "Readiness generated",
      artifactRefs: { readinessReportId: application.readinessReportId },
      metadata: {}
    } : null,
    application.optimizationPatchSetId ? {
      eventType: "patch_set_generated",
      title: "Patch set generated",
      artifactRefs: { optimizationPatchSetId: application.optimizationPatchSetId },
      metadata: {}
    } : null,
    application.renderedResumeId ? {
      eventType: "version_created",
      title: "Version created",
      artifactRefs: {
        resumeVersionId: application.resumeVersionId,
        renderedResumeId: application.renderedResumeId
      },
      metadata: {}
    } : null
  ].filter(Boolean);
}

function applicationJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'company', company, 'position', position,
    'jobDescriptionId', job_description_id, 'resumeVersionId', resume_version_id,
    'matchReportId', match_report_id, 'readinessReportId', readiness_report_id,
    'optimizationPatchSetId', optimization_patch_set_id, 'renderedResumeId', rendered_resume_id,
    'status', status, 'metadata', metadata, 'createdAt', created_at,
    'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}

function eventJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'applicationId', application_id,
    'eventType', event_type, 'title', title, 'body', body,
    'fromStatus', from_status, 'toStatus', to_status,
    'artifactRefs', artifact_refs, 'metadata', metadata,
    'createdAt', created_at, 'deletedAt', deleted_at
  ) AS value`;
}

function noteJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'applicationId', application_id,
    'body', body, 'createdAt', created_at, 'updatedAt', updated_at,
    'deletedAt', deleted_at
  ) AS value`;
}
