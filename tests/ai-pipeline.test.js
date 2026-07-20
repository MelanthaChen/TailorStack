import assert from "node:assert/strict";
import test from "node:test";
import { createJobEnhancementPipeline } from "../packages/ai/pipeline/job-enhancement-pipeline.js";
import { DeterministicJobParser } from "../apps/api/src/services/deterministic-job-parser.js";
import { sampleJobDescription } from "./job-fixtures.js";

test("AI enhancement pipeline normalizes deterministic output without overwriting facts", async () => {
  const deterministicModel = new DeterministicJobParser().parse(sampleJobDescription);
  const enhanced = await createJobEnhancementPipeline().run({ deterministicModel, requestId: "test-request" });
  assert.equal(enhanced.company, "Acme Cloud");
  assert.equal(enhanced.jobTitle, "Software Engineer Intern");
  assert.ok(enhanced.normalizedSkills.includes("JavaScript"));
  assert.ok(enhanced.normalizedSkills.includes("Node.js"));
  assert.ok(enhanced.inferredSkillGroups.programming_language.includes("TypeScript"));
  assert.ok(enhanced.requirements.some((requirement) => requirement.normalizedText === "Amazon Web Services"));
});
