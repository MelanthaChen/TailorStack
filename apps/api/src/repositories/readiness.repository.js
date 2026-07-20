import { queryJson, sql } from "./sql-utils.js";

export class InMemoryReadinessRepository {
  constructor() {
    this.reports = new Map();
    this.findings = new Map();
    this.recommendations = new Map();
  }

  async createReport(input) {
    const now = new Date().toISOString();
    const report = {
      id: crypto.randomUUID(),
      userId: input.userId,
      resumeId: input.resumeId,
      jobDescriptionId: input.jobDescriptionId,
      matchReportId: input.matchReportId,
      readinessScore: input.readinessScore,
      summary: input.summary,
      status: "succeeded",
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.reports.set(report.id, report);

    const findingIdMap = new Map();
    const findings = input.findings.map((item) => {
      const id = crypto.randomUUID();
      findingIdMap.set(item, id);
      return {
        id,
        userId: input.userId,
        readinessReportId: report.id,
        category: item.category,
        severity: item.severity,
        evidence: item.evidence ?? [],
        reason: item.reason,
        confidence: item.confidence,
        metadata: item.metadata ?? {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };
    });
    findings.forEach((item) => this.findings.set(item.id, item));

    const recommendations = input.recommendations.map((item) => ({
      id: crypto.randomUUID(),
      userId: input.userId,
      readinessReportId: report.id,
      findingId: findMatchingFindingId(findings, item),
      category: item.category,
      priority: item.priority,
      text: item.text,
      evidenceRefs: item.evidenceRefs ?? [],
      confidence: item.confidence,
      metadata: item.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }));
    recommendations.forEach((item) => this.recommendations.set(item.id, item));

    return { report, findings, recommendations };
  }

  async findReportForUser(readinessReportId, userId) {
    const report = this.reports.get(readinessReportId);
    if (!report || report.userId !== userId || report.deletedAt) return null;
    return {
      report,
      findings: [...this.findings.values()].filter((item) => item.readinessReportId === readinessReportId && !item.deletedAt),
      recommendations: [...this.recommendations.values()].filter((item) => item.readinessReportId === readinessReportId && !item.deletedAt)
    };
  }
}

export class PostgresReadinessRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createReport(input) {
    const now = new Date().toISOString();
    const reportId = crypto.randomUUID();
    await queryJson(this.databaseUrl, `
      INSERT INTO application_readiness_reports (
        id, user_id, resume_id, job_description_id, match_report_id,
        readiness_score, summary, status, created_at, updated_at
      )
      VALUES (
        ${sql(reportId)}, ${sql(input.userId)}, ${sql(input.resumeId)},
        ${sql(input.jobDescriptionId)}, ${sql(input.matchReportId)},
        ${input.readinessScore}, ${sql(input.summary)}::jsonb, 'succeeded',
        ${sql(now)}, ${sql(now)}
      )
      RETURNING json_build_object('id', id) AS value
    `);

    const findingIdByCategory = new Map();
    for (const item of input.findings) {
      const id = crypto.randomUUID();
      if (!findingIdByCategory.has(item.category)) findingIdByCategory.set(item.category, id);
      await queryJson(this.databaseUrl, `
        INSERT INTO readiness_findings (
          id, user_id, readiness_report_id, category, severity, evidence,
          reason, confidence, metadata, created_at, updated_at
        )
        VALUES (
          ${sql(id)}, ${sql(input.userId)}, ${sql(reportId)}, ${sql(item.category)},
          ${sql(item.severity)}, ${sql(item.evidence ?? [])}::jsonb,
          ${sql(item.reason)}, ${item.confidence}, ${sql(item.metadata ?? {})}::jsonb,
          ${sql(now)}, ${sql(now)}
        )
        RETURNING json_build_object('id', id) AS value
      `);
    }

    for (const item of input.recommendations) {
      await queryJson(this.databaseUrl, `
        INSERT INTO optimization_recommendations (
          id, user_id, readiness_report_id, finding_id, category, priority,
          text, evidence_refs, confidence, metadata, created_at, updated_at
        )
        VALUES (
          ${sql(crypto.randomUUID())}, ${sql(input.userId)}, ${sql(reportId)},
          ${sql(findingIdByCategory.get(item.category) ?? null)},
          ${sql(item.category)}, ${sql(item.priority)}, ${sql(item.text)},
          ${sql(item.evidenceRefs ?? [])}::jsonb, ${item.confidence},
          ${sql(item.metadata ?? {})}::jsonb, ${sql(now)}, ${sql(now)}
        )
        RETURNING json_build_object('id', id) AS value
      `);
    }
    return this.findReportForUser(reportId, input.userId);
  }

  async findReportForUser(readinessReportId, userId) {
    const reportRows = await queryJson(this.databaseUrl, `
      SELECT ${reportJson()}
      FROM application_readiness_reports
      WHERE id = ${sql(readinessReportId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    const report = reportRows[0] ?? null;
    if (!report) return null;
    const findings = await queryJson(this.databaseUrl, `
      SELECT ${findingJson()}
      FROM readiness_findings
      WHERE readiness_report_id = ${sql(readinessReportId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY CASE severity WHEN 'weakness' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, category
    `);
    const recommendations = await queryJson(this.databaseUrl, `
      SELECT ${recommendationJson()}
      FROM optimization_recommendations
      WHERE readiness_report_id = ${sql(readinessReportId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, category
    `);
    return { report, findings, recommendations };
  }
}

export function createReadinessRepository(config) {
  if (config.authRepositoryDriver === "memory") return new InMemoryReadinessRepository();
  return new PostgresReadinessRepository({ databaseUrl: config.databaseUrl });
}

function findMatchingFindingId(findings, recommendation) {
  return findings.find((finding) => finding.category === recommendation.category)?.id ?? null;
}

function reportJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'resumeId', resume_id, 'jobDescriptionId', job_description_id,
    'matchReportId', match_report_id, 'readinessScore', readiness_score, 'summary', summary,
    'status', status, 'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}

function findingJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'readinessReportId', readiness_report_id,
    'category', category, 'severity', severity, 'evidence', evidence,
    'reason', reason, 'confidence', confidence, 'metadata', metadata,
    'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}

function recommendationJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'readinessReportId', readiness_report_id,
    'findingId', finding_id, 'category', category, 'priority', priority,
    'text', text, 'evidenceRefs', evidence_refs, 'confidence', confidence,
    'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at,
    'deletedAt', deleted_at
  ) AS value`;
}
