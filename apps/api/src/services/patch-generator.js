import { createOptimizationWordingPipeline } from "../../../../packages/ai/pipeline/optimization-wording-pipeline.js";
import { findBullet } from "./patch-validator.js";

export class PatchGenerator {
  constructor({ wordingPipeline = createOptimizationWordingPipeline() } = {}) {
    this.wordingPipeline = wordingPipeline;
  }

  async generate({ canonicalResume, readinessResult, matchResult, requestId }) {
    const patches = [];
    const evidenceById = new Map((matchResult.evidence ?? []).map((item) => [item.id, item]));
    const firstEntity = firstWritableEntity(canonicalResume.sections);

    for (const recommendation of readinessResult.recommendations ?? []) {
      const evidenceRef = (recommendation.evidenceRefs ?? [])[0];
      if (!evidenceRef) continue;
      const matchEvidence = evidenceById.get(evidenceRef.sourceId);
      if (matchEvidence?.bulletId) {
        const bullet = findBullet(canonicalResume.sections, matchEvidence.bulletId);
        if (!bullet) continue;
        const intent = {
          operation: "replace_bullet",
          before: bullet.text,
          guidance: recommendation.text
        };
        const wording = await this.wordingPipeline.run({ patchIntent: intent, requestId });
        patches.push(patch({
          operation: "replace_bullet",
          target: { bulletId: bullet.id, entityId: matchEvidence.entityId, sectionId: matchEvidence.sectionId },
          reason: recommendation.text,
          confidence: recommendation.confidence,
          evidence: recommendation.evidenceRefs,
          before: bullet.text,
          after: wording.after,
          metadata: { recommendationId: recommendation.id, explanation: wording.explanation }
        }));
        continue;
      }
      if (recommendation.category === "leadership" && firstEntity) {
        patches.push(patch({
          operation: "insert_bullet",
          target: { entityId: firstEntity.id, sectionId: firstEntity.sectionId, position: "end" },
          reason: recommendation.text,
          confidence: recommendation.confidence,
          evidence: recommendation.evidenceRefs,
          before: null,
          after: "Clarify leadership, ownership, or collaboration impact here only if already true.",
          metadata: { recommendationId: recommendation.id }
        }));
        continue;
      }
      const skill = recommendation.metadata?.sourceFindingCategory === recommendation.category
        ? skillFromRecommendation(recommendation.text)
        : null;
      if (skill) {
        patches.push(patch({
          operation: "insert_skill",
          target: { resumeId: canonicalResume.resume.id, sectionType: "skills" },
          reason: recommendation.text,
          confidence: recommendation.confidence,
          evidence: recommendation.evidenceRefs,
          before: null,
          after: skill,
          metadata: { recommendationId: recommendation.id, requiresUserTruthConfirmation: true }
        }));
      }
    }

    if (!patches.length && firstEntity) {
      patches.push(patch({
        operation: "insert_bullet",
        target: { entityId: firstEntity.id, sectionId: firstEntity.sectionId, position: "end" },
        reason: "Improve application readiness with a truthful clarification based on existing evidence.",
        confidence: 0.62,
        evidence: [{ sourceType: "readiness_report", sourceId: readinessResult.report.id, text: "Readiness report produced reviewable recommendations." }],
        before: null,
        after: "Add a truthful clarification here after reviewing the readiness report.",
        metadata: { fallback: true }
      }));
    }

    return patches;
  }
}

function patch(input) {
  return {
    id: crypto.randomUUID(),
    ...input
  };
}

function firstWritableEntity(sections) {
  for (const section of sections ?? []) {
    if (section.visibility === "hidden") continue;
    const entity = (section.entities ?? []).find((item) => item.visibility !== "hidden");
    if (entity) return entity;
  }
  return null;
}

function skillFromRecommendation(text) {
  const match = /Mention\s+(.+?)\s+more clearly/i.exec(text);
  return match?.[1]?.trim() ?? null;
}
