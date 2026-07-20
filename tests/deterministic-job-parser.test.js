import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicJobParser } from "../apps/api/src/services/deterministic-job-parser.js";
import { sampleJobDescription } from "./job-fixtures.js";

test("deterministic parser extracts structured job facts without AI", () => {
  const parsed = new DeterministicJobParser().parse(sampleJobDescription);
  assert.equal(parsed.company, "Acme Cloud");
  assert.equal(parsed.jobTitle, "Software Engineer Intern");
  assert.equal(parsed.employmentType, "internship");
  assert.equal(parsed.yearsExperience, 1);
  assert.equal(parsed.salary.min, 45000);
  assert.ok(parsed.requiredSkills.includes("JavaScript"));
  assert.ok(parsed.requiredSkills.includes("TypeScript"));
  assert.ok(parsed.requiredSkills.includes("Amazon Web Services"));
  assert.ok(parsed.preferredSkills.includes("Kubernetes"));
  assert.ok(parsed.responsibilities.some((item) => /backend APIs/i.test(item)));
  assert.ok(parsed.keywords.includes("Backend"));
});

test("deterministic parser rejects empty and extremely short JDs", () => {
  assert.throws(() => new DeterministicJobParser().parse(""), /empty/);
  assert.throws(() => new DeterministicJobParser().parse("Software engineer"), /too short/);
});
