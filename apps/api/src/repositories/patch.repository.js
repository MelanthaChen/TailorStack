import { queryJson, sql } from "./sql-utils.js";

export class InMemoryPatchRepository {
  constructor() {
    this.patchSets = new Map();
    this.patches = new Map();
    this.reviewStates = new Map();
  }

  async createPatchSet(input) {
    const now = new Date().toISOString();
    const patchSet = {
      id: crypto.randomUUID(),
      userId: input.userId,
      resumeId: input.resumeId,
      readinessReportId: input.readinessReportId,
      matchReportId: input.matchReportId,
      status: "review_required",
      patchCount: input.patches.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.patchSets.set(patchSet.id, patchSet);
    const patches = input.patches.map((item, index) => ({
      id: crypto.randomUUID(),
      userId: input.userId,
      patchSetId: patchSet.id,
      operation: item.operation,
      target: item.target,
      reason: item.reason,
      confidence: item.confidence,
      evidence: item.evidence,
      before: item.before,
      after: item.after,
      displayOrder: index,
      metadata: item.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }));
    patches.forEach((patch) => {
      this.patches.set(patch.id, patch);
      this.reviewStates.set(patch.id, reviewState({ userId: input.userId, patchSetId: patchSet.id, patchId: patch.id, state: "pending", now }));
    });
    return this.findPatchSetForUser(patchSet.id, input.userId);
  }

  async findPatchSetForUser(patchSetId, userId) {
    const patchSet = this.patchSets.get(patchSetId);
    if (!patchSet || patchSet.userId !== userId || patchSet.deletedAt) return null;
    const patches = [...this.patches.values()]
      .filter((patch) => patch.patchSetId === patchSetId && patch.userId === userId && !patch.deletedAt)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const reviewStates = patches.map((patch) => this.reviewStates.get(patch.id)).filter(Boolean);
    return { patchSet, patches, reviewStates };
  }

  async updatePatchReviewState({ userId, patchId, state }) {
    const current = this.reviewStates.get(patchId);
    if (!current || current.userId !== userId) return null;
    const updated = { ...current, state, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.reviewStates.set(patchId, updated);
    return this.findPatchSetForUser(current.patchSetId, userId);
  }

  async updatePatchSetReviewState({ userId, patchSetId, state }) {
    const result = await this.findPatchSetForUser(patchSetId, userId);
    if (!result) return null;
    for (const patch of result.patches) {
      const current = this.reviewStates.get(patch.id);
      this.reviewStates.set(patch.id, { ...current, state, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    return this.findPatchSetForUser(patchSetId, userId);
  }
}

export class PostgresPatchRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createPatchSet(input) {
    const now = new Date().toISOString();
    const patchSetId = crypto.randomUUID();
    await queryJson(this.databaseUrl, `
      INSERT INTO optimization_patch_sets (
        id, user_id, resume_id, readiness_report_id, match_report_id,
        status, patch_count, created_at, updated_at
      )
      VALUES (
        ${sql(patchSetId)}, ${sql(input.userId)}, ${sql(input.resumeId)},
        ${sql(input.readinessReportId)}, ${sql(input.matchReportId)},
        'review_required', ${input.patches.length}, ${sql(now)}, ${sql(now)}
      )
      RETURNING json_build_object('id', id) AS value
    `);

    for (const [index, item] of input.patches.entries()) {
      const patchId = crypto.randomUUID();
      await queryJson(this.databaseUrl, `
        INSERT INTO optimization_patches (
          id, user_id, patch_set_id, operation, target, reason, confidence,
          evidence, before_value, after_value, display_order, metadata,
          created_at, updated_at
        )
        VALUES (
          ${sql(patchId)}, ${sql(input.userId)}, ${sql(patchSetId)},
          ${sql(item.operation)}, ${sql(item.target)}::jsonb, ${sql(item.reason)},
          ${item.confidence}, ${sqlJson(item.evidence)}, ${sqlJson(item.before)},
          ${sqlJson(item.after)}, ${index}, ${sqlJson(item.metadata ?? {})},
          ${sql(now)}, ${sql(now)}
        )
        RETURNING json_build_object('id', id) AS value
      `);
      await queryJson(this.databaseUrl, `
        INSERT INTO patch_review_states (
          id, user_id, patch_set_id, patch_id, state, reviewed_at, created_at, updated_at
        )
        VALUES (
          ${sql(crypto.randomUUID())}, ${sql(input.userId)}, ${sql(patchSetId)},
          ${sql(patchId)}, 'pending', NULL, ${sql(now)}, ${sql(now)}
        )
        RETURNING json_build_object('id', id) AS value
      `);
    }
    return this.findPatchSetForUser(patchSetId, input.userId);
  }

  async findPatchSetForUser(patchSetId, userId) {
    const patchSetRows = await queryJson(this.databaseUrl, `
      SELECT ${patchSetJson()}
      FROM optimization_patch_sets
      WHERE id = ${sql(patchSetId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      LIMIT 1
    `);
    const patchSet = patchSetRows[0] ?? null;
    if (!patchSet) return null;
    const patches = await queryJson(this.databaseUrl, `
      SELECT ${patchJson()}
      FROM optimization_patches
      WHERE patch_set_id = ${sql(patchSetId)} AND user_id = ${sql(userId)} AND deleted_at IS NULL
      ORDER BY display_order
    `);
    const reviewStates = await queryJson(this.databaseUrl, `
      SELECT ${reviewStateJson()}
      FROM patch_review_states
      WHERE patch_set_id = ${sql(patchSetId)} AND user_id = ${sql(userId)}
      ORDER BY created_at
    `);
    return { patchSet, patches, reviewStates };
  }

  async updatePatchReviewState({ userId, patchId, state }) {
    const rows = await queryJson(this.databaseUrl, `
      UPDATE patch_review_states
      SET state = ${sql(state)}, reviewed_at = ${sql(new Date().toISOString())}, updated_at = ${sql(new Date().toISOString())}
      WHERE patch_id = ${sql(patchId)} AND user_id = ${sql(userId)}
      RETURNING json_build_object('patchSetId', patch_set_id) AS value
    `);
    if (!rows[0]) return null;
    return this.findPatchSetForUser(rows[0].patchSetId, userId);
  }

  async updatePatchSetReviewState({ userId, patchSetId, state }) {
    const rows = await queryJson(this.databaseUrl, `
      UPDATE patch_review_states
      SET state = ${sql(state)}, reviewed_at = ${sql(new Date().toISOString())}, updated_at = ${sql(new Date().toISOString())}
      WHERE patch_set_id = ${sql(patchSetId)} AND user_id = ${sql(userId)}
      RETURNING json_build_object('patchSetId', patch_set_id) AS value
    `);
    if (!rows.length) return null;
    return this.findPatchSetForUser(patchSetId, userId);
  }
}

export function createPatchRepository(config) {
  if (config.authRepositoryDriver === "memory") return new InMemoryPatchRepository();
  return new PostgresPatchRepository({ databaseUrl: config.databaseUrl });
}

function reviewState({ userId, patchSetId, patchId, state, now }) {
  return {
    id: crypto.randomUUID(),
    userId,
    patchSetId,
    patchId,
    state,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function sqlJson(value) {
  if (value === undefined) return "NULL";
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function patchSetJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'resumeId', resume_id, 'readinessReportId', readiness_report_id,
    'matchReportId', match_report_id, 'status', status, 'patchCount', patch_count,
    'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}

function patchJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'patchSetId', patch_set_id, 'operation', operation,
    'target', target, 'reason', reason, 'confidence', confidence, 'evidence', evidence,
    'before', before_value, 'after', after_value, 'displayOrder', display_order,
    'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at,
    'deletedAt', deleted_at
  ) AS value`;
}

function reviewStateJson() {
  return `json_build_object(
    'id', id, 'userId', user_id, 'patchSetId', patch_set_id, 'patchId', patch_id,
    'state', state, 'reviewedAt', reviewed_at, 'createdAt', created_at,
    'updatedAt', updated_at
  ) AS value`;
}
