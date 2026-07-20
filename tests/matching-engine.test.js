import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGenerator } from "../apps/api/src/services/evidence-generator.js";
import { GapAnalyzer } from "../apps/api/src/services/gap-analyzer.js";
import { buildResumeMatchProfile } from "../apps/api/src/services/matching-normalizer.js";
import { WeightedScorer } from "../apps/api/src/services/weighted-scorer.js";

const sections = [{
  id: "section-1",
  title: "Experience",
  sectionType: "experience",
  visibility: "visible",
  entities: [{
    id: "entity-1",
    title: "Software Engineer",
    organization: "Acme",
    visibility: "visible",
    bullets: [{
      id: "bullet-1",
      text: "Built backend services with Python, TypeScript, Node.js, React, AWS, and Docker.",
      visibility: "visible"
    }]
  }]
}];

const requirements = [
  {
    id: "req-1",
    requirementType: "required_skill",
    text: "Python",
    normalizedText: "Python",
    category: "programming_language",
    importance: "high",
    weight: 1,
    confidence: 0.95
  },
  {
    id: "req-2",
    requirementType: "required_skill",
    text: "Kubernetes",
    normalizedText: "Kubernetes",
    category: "tool",
    importance: "high",
    weight: 1,
    confidence: 0.9
  }
];

test("matching normalizer indexes visible canonical resume evidence", () => {
  const profile = buildResumeMatchProfile(sections);
  assert.ok(profile.skills.includes("Python"));
  assert.ok(profile.skills.includes("TypeScript"));
  assert.equal(profile.evidenceItems.length, 1);
});

test("evidence generator creates structured evidence for deterministic matches", () => {
  const profile = buildResumeMatchProfile(sections);
  const result = new EvidenceGenerator().generate({ profile, requirements });
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].jobRequirementId, "req-1");
  assert.equal(result.evidence[0].bulletId, "bullet-1");
  assert.equal(result.evidence[0].matchedBy, "normalized_match");
  assert.equal(result.skillMatches[0].normalizedSkill, "Python");
});

test("gap analyzer explains missing requirements", () => {
  const profile = buildResumeMatchProfile(sections);
  const evidence = new EvidenceGenerator().generate({ profile, requirements }).evidence;
  const gaps = new GapAnalyzer().analyze({
    profile,
    requirements,
    evidence,
    jobDescription: { parsedMetadata: {} }
  });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].normalizedSkill, "Kubernetes");
  assert.match(gaps[0].reason, /No visible canonical resume evidence/);
});

test("weighted scorer returns overall and category breakdown", () => {
  const evidence = [{ jobRequirementId: "req-1", score: 1 }];
  const gaps = [{ normalizedSkill: "Kubernetes" }];
  const score = new WeightedScorer().score({ requirements, evidence, gaps });
  assert.equal(score.overallScore, 50);
  assert.equal(score.categoryScores.programming_languages, 100);
  assert.equal(score.categoryScores.tool, 0);
});
