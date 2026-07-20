import assert from "node:assert/strict";
import test from "node:test";
import { PatchGenerator } from "../apps/api/src/services/patch-generator.js";
import { PatchValidator } from "../apps/api/src/services/patch-validator.js";
import { InMemoryPatchRepository } from "../apps/api/src/repositories/patch.repository.js";
import { ReviewStateService } from "../apps/api/src/services/review-state.service.js";

const canonicalResume = {
  resume: { id: "resume-1" },
  sections: [{
    id: "section-1",
    sectionType: "experience",
    title: "Experience",
    visibility: "visible",
    entities: [{
      id: "entity-1",
      sectionId: "section-1",
      visibility: "visible",
      bullets: [{
        id: "bullet-1",
        text: "Built backend APIs with Python.",
        visibility: "visible"
      }]
    }]
  }]
};

test("patch generator creates reviewable patches with evidence", async () => {
  const generator = new PatchGenerator();
  const patches = await generator.generate({
    canonicalResume,
    readinessResult: {
      report: { id: "readiness-1" },
      recommendations: [{
        id: "rec-1",
        category: "experience_alignment",
        text: "Clarify production deployment impact when already true.",
        confidence: 0.8,
        evidenceRefs: [{ sourceType: "match_evidence", sourceId: "evidence-1", text: "Built backend APIs with Python." }]
      }]
    },
    matchResult: {
      evidence: [{
        id: "evidence-1",
        bulletId: "bullet-1",
        entityId: "entity-1",
        sectionId: "section-1"
      }]
    },
    requestId: "test"
  });

  assert.equal(patches.length, 1);
  assert.equal(patches[0].operation, "replace_bullet");
  assert.equal(patches[0].target.bulletId, "bullet-1");
  assert.ok(patches[0].evidence.length > 0);
});

test("patch validator rejects missing targets and duplicate insert content", () => {
  const validator = new PatchValidator();
  assert.throws(() => validator.validatePatch({
    operation: "replace_bullet",
    target: { bulletId: "missing" },
    reason: "Missing target",
    confidence: 0.8,
    evidence: [{ sourceType: "test", text: "evidence" }],
    before: "Nope",
    after: "Still nope"
  }, canonicalResume), /missing bullet target/);

  assert.throws(() => validator.validatePatch({
    operation: "insert_bullet",
    target: { entityId: "entity-1" },
    reason: "Duplicate",
    confidence: 0.8,
    evidence: [{ sourceType: "test", text: "evidence" }],
    before: null,
    after: "Built backend APIs with Python."
  }, canonicalResume), /duplicates existing canonical content/);
});

test("review state service accepts and rejects without patch mutation", async () => {
  const repository = new InMemoryPatchRepository();
  const created = await repository.createPatchSet({
    userId: "user-1",
    resumeId: "resume-1",
    readinessReportId: "readiness-1",
    matchReportId: "match-1",
    patches: [{
      operation: "replace_bullet",
      target: { bulletId: "bullet-1" },
      reason: "Improve clarity",
      confidence: 0.8,
      evidence: [{ sourceType: "test", text: "evidence" }],
      before: "Built APIs.",
      after: "Built APIs with clearer context.",
      metadata: {}
    }]
  });
  const patchId = created.patches[0].id;
  const service = new ReviewStateService({ patchRepository: repository, logger: { info() {} } });
  const updated = await service.setPatchReviewState({
    user: { id: "user-1" },
    patchId,
    state: "accepted",
    requestId: "test"
  });

  assert.equal(updated.reviewStates[0].state, "accepted");
  assert.equal(updated.patches[0].after, "Built APIs with clearer context.");
});
