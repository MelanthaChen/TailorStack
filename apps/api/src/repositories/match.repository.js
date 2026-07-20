import { queryJson, sql } from "./sql-utils.js";

export class InMemoryMatchRepository {
  constructor() {
    this.reports = new Map();
    this.evidence = new Map();
    this.skillMatches = new Map();
    this.gaps = new Map();
  }

  async createReport(input) {
    const now = new Date().toISOString();
    const report = {
      id: crypto.randomUUID(),
      userId: input.userId,
      resumeId: input.resumeId,
      jobDescriptionId: input.jobDescriptionId,
      overallScore: input.overallScore,
      categoryScores: input.categoryScores,
      summary: input.summary,
      status: "succeeded",
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.reports.set(report.id, report);

    const evidenceIdMap = new Map();
    const evidence = input.evidence.map((item) => {
      const id = crypto.randomUUID();
      evidenceIdMap.set(item.id, id);
      return {
        id,
        userId: input.userId,
        matchReportId: report.id,
        jobRequirementId: item.jobRequirementId,
        category: item.category,
        requirementText: item.requirementText,
        matchedBy: item.matchedBy,
        sectionId: item.sectionId,
        entityId: item.entityId,
        bulletId: item.bulletId,
        evidenceText: item.evidenceText,
        confidence: item.confidence,
        score: item.score,
        metadata: item.metadata ?? {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };
    });
    evidence.forEach((item) => this.evidence.set(item.id, item));

    const skillMatches = input.skillMatches.map((item) => ({
      id: crypto.randomUUID(),
      userId: input.userId,
      matchReportId: report.id,
      evidenceId: evidenceIdMap.get(item.evidenceLocalId) ?? null,
      skill: item.skill,
      normalizedSkill: item.normalizedSkill,
      category: item.category,
      matchType: item.matchType,
      confidence: item.confidence,
      score: item.score,
      metadata: item.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }));
    skillMatches.forEach((item) => this.skillMatches.set(item.id, item));

    const gaps = input.gaps.map((item) => ({
      id: crypto.randomUUID(),
      userId: input.userId,
      matchReportId: report.id,
      skill: item.skill,
      normalizedSkill: item.normalizedSkill,
      gapType: item.gapType,
      reason: item.reason,
      importance: item.importance,
      confidence: item.confidence,
      metadata: item.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }));
    gaps.forEach((item) => this.gaps.set(item.id, item));

    return { report, evidence, skillMatches, gaps };
  }

  async findReportForUser(matchReportId, userId) {
    const report = this.reports.get(matchReportId);
    if (!report || report.userId !== userId || report.deletedAt) return null;
    return {
      report,
      evidence: [...this.evidence.values()].filter((item) => item.matchReportId === matchReportId && !item.deletedAt),
      skillMatches: [...this.skillMatches.values()].filter((item) => item.matchReportId === matchReportId && !item.deletedAt),
      gaps: [...this.gaps.values()].filter((item) => item.matchReportId === matchReportId && !item.deletedAt)
    };
  }
}

export class PostgresMatchRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createReport(input) {
    const now = new Date().toISOString();
    const reportId = crypto.randomUUID();
    const reportRows = await queryJson(this.databaseUrl, `
      INSERT INTO match_reports (
        id, user_id, resume_id, job_description_id, overall_score,
        category_scores, summary, status, created_at, updated_at
      )
      VALUES (
        ${sql(reportId)}, ${sql(input.userId)}, ${sql(input.resumeId)},
        ${sql(input.jobDescriptionId)}, ${input.overallScore},
        ${sql(input.categoryScores)}::jsonb, ${sql(input.summary)}::jsonb,
        'succeeded', ${sql(now)}, ${sql(now)}
      )
      RETURNING ${reportJson()}
    `);

    const evidenceIdMap = new Map();
    for (const item of input.evidence) {
      const id = crypto.randomUUID();
      evidenceIdMap.set(item.id, id);
      await queryJson(this.databaseUrl, `
        INSERT INTO match_evidence (
          id, user_id, match_report_id, job_requirement_id, category, requirement_text,
          matched_by, section_id, entity_id, bullet_id, evidence_text, confidence,
          score, metadata, created_at, updated_at
        )
        VALUES (
          ${sql(id)}, ${sql(input.userId)}, ${sql(reportId)}, ${sql(item.jobRequirementId)},
          ${sql(item.category)}, ${sql(item.requirementText)}, ${sql(item.matchedBy)},
          ${sql(item.sectionId)}, ${sql(item.entityId)}, ${sql(item.bulletId)},
          ${sql(item.evidenceText)}, ${item.confidence}, ${item.score},
          ${sql(item.metadata ?? {})}::jsonb, ${sql(now)}, ${sql(now)}
        )
        RETURNING json_build_object('id', id) AS value
      `);
    }

    for (const item of input.skillMatches) {
      await queryJson(this.databaseUrl, `
        INSERT INTO skill_matches (
          id, user_id, match_report_id, evidence_id, skill, normalized_skill,
          category, match_type, confidence, score, metadata, created_at, updated_at
        )
        VALUES (
          ${sql(crypto.randomUUID())}, ${sql(input.userId)}, ${sql(reportId)},
          ${sql(evidenceIdMap.get(item.evidenceLocalId) ?? null)}, ${sql(item.skill)},
          ${sql(item.normalizedSkill)}, ${sql(item.category)}, ${sql(item.matchType)},
          ${item.confidence}, ${item.score}, ${sql(item.metadata ?? {})}::jsonb,
          ${sql(now)}, ${sql(now)}
        )
        RETURNING json_build_object('id', id) AS value
      `);
    }

    for (const item of input.gaps) {
      await queryJson(this.databaseUrl, `
        INSERT INTO skill_gaps (
          id, user_id, match_report_id, skill, normalized_skill, gap_type,
          reason, importance, confidence, metadata, created_at, updated_at
        )
        VALUES (
          ${sql(crypto.randomUUID())}, ${sql(input.userId)}, ${sql(reportId)},
          ${sql(item.skill)}, ${sql(item.normalizedSkill)}, ${sql(item.gapType)},
          ${sql(item.reason)}, ${sql(item.importance)}, ${item.confidence},
          ${sql(item.metadata ?? {})}::jsonb, ${sql(now)}, ${sql(now)}
        )
        RETURNING json_build_object('id', id) AS value
      `);
    }

    return this.findReportForUser(reportId, input.userId) ?? { report: reportRows[0], evidence: [], skillMatches: [], gaps: [] };
  }

  async findReportForUser(matchReportId, userId) {
    const reportRows = await queryJson(this.databaseUrl, `
      SELECT ${reportJson()}
      FROM match_reports
      WHERE id = ${sql(matchReportId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    const report = reportRows[0] ?? null;
    if (!report) return null;
    const evidence = await queryJson(this.databaseUrl, `
      SELECT ${evidenceJson()}
      FROM match_evidence
      WHERE match_report_id = ${sql(matchReportId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY confidence DESC, created_at
    `);
    const skillMatches = await queryJson(this.databaseUrl, `
      SELECT ${skillMatchJson()}
      FROM skill_matches
      WHERE match_report_id = ${sql(matchReportId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY confidence DESC, normalized_skill
    `);
    const gaps = await queryJson(this.databaseUrl, `
      SELECT ${gapJson()}
      FROM skill_gaps
      WHERE match_report_id = ${sql(matchReportId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY CASE importance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, normalized_skill
    `);
    return { report, evidence, skillMatches, gaps };
  }
}

export function createMatchRepository(config) {
  if (config.authRepositoryDriver === "memory") return new InMemoryMatchRepository();
  return new PostgresMatchRepository({ databaseUrl: config.databaseUrl });
}

function reportJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'resumeId', resume_id, 'jobDescriptionId', job_description_id,
    'overallScore', overall_score, 'categoryScores', category_scores, 'summary', summary,
    'status', status, 'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}

function evidenceJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'matchReportId', match_report_id,
    'jobRequirementId', job_requirement_id, 'category', category,
    'requirementText', requirement_text, 'matchedBy', matched_by,
    'sectionId', section_id, 'entityId', entity_id, 'bulletId', bullet_id,
    'evidenceText', evidence_text, 'confidence', confidence, 'score', score,
    'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at,
    'deletedAt', deleted_at
  ) AS value`;
}

function skillMatchJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'matchReportId', match_report_id, 'evidenceId', evidence_id,
    'skill', skill, 'normalizedSkill', normalized_skill, 'category', category,
    'matchType', match_type, 'confidence', confidence, 'score', score,
    'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at,
    'deletedAt', deleted_at
  ) AS value`;
}

function gapJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'matchReportId', match_report_id,
    'skill', skill, 'normalizedSkill', normalized_skill, 'gapType', gap_type,
    'reason', reason, 'importance', importance, 'confidence', confidence,
    'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at,
    'deletedAt', deleted_at
  ) AS value`;
}
