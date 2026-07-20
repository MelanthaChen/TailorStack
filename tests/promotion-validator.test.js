import assert from "node:assert/strict";
import test from "node:test";
import { validateDraftForPromotion } from "../apps/api/src/services/promotion-validator.js";

const validSections = [{
  id: "section_1",
  sectionType: "experience",
  title: "Experience",
  confidence: 0.8,
  entities: [{
    id: "entity_1",
    sectionId: "section_1",
    entityType: "experience",
    title: "Backend Engineer",
    organization: "Example",
    startDate: null,
    endDate: null,
    confidence: 0.8,
    bullets: [{
      id: "bullet_1",
      sectionId: "section_1",
      entityId: "entity_1",
      text: "Built APIs",
      confidence: 0.8
    }]
  }]
}];

test("validateDraftForPromotion accepts valid parsed draft", () => {
  const result = validateDraftForPromotion({
    resume: { status: "review_required" },
    parseJob: { status: "succeeded" },
    sections: validSections
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateDraftForPromotion rejects unsucceeded parser job", () => {
  const result = validateDraftForPromotion({
    resume: { status: "review_required" },
    parseJob: { status: "queued" },
    sections: validSections
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /succeeded/);
});

test("validateDraftForPromotion rejects orphan bullet relationships", () => {
  const result = validateDraftForPromotion({
    resume: { status: "review_required" },
    parseJob: { status: "succeeded" },
    sections: [{
      ...validSections[0],
      entities: [{
        ...validSections[0].entities[0],
        bullets: [{
          ...validSections[0].entities[0].bullets[0],
          entityId: "other_entity"
        }]
      }]
    }]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /wrong entity/);
});

test("validateDraftForPromotion reports low confidence as warning", () => {
  const result = validateDraftForPromotion({
    resume: { status: "review_required" },
    parseJob: { status: "succeeded" },
    sections: [{
      ...validSections[0],
      confidence: 0.4
    }]
  });

  assert.equal(result.valid, true);
  assert.equal(result.warnings.length > 0, true);
});
