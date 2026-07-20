import assert from "node:assert/strict";
import test from "node:test";
import { ReadinessFindingGenerator } from "../apps/api/src/services/readiness-finding-generator.js";
import { ReadinessRecommendationGenerator } from "../apps/api/src/services/readiness-recommendation-generator.js";
import { ReadinessExplanationPipeline } from "../packages/ai/pipeline/readiness-explanation-pipeline.js";

const matchResult = {
  report: {
    id: "match-1",
    resumeId: "resume-1",
    jobDescriptionId: "job-1",
    overallScore: 68,
    categoryScores: {
      programming_languages: 100,
      cloud_platforms: 50,
      responsibility: 50
    }
  },
  evidence: [{
    id: "evidence-1",
    category: "programming_language",
    evidenceText: "Built 3 backend APIs with Python and TypeScript.",
    confidence: 0.96,
    metadata: { sectionTitle: "Experience" }
  }],
  skillMatches: [{
    id: "skill-match-1",
    normalizedSkill: "Python",
    category: "programming_language",
    matchType: "normalized_match",
    confidence: 0.96
  }],
  gaps: [{
    id: "gap-1",
    normalizedSkill: "Amazon Web Services",
    gapType: "missing_skill",
    reason: "No visible canonical resume evidence matched the cloud platform requirement.",
    importance: "high",
    confidence: 0.9,
    metadata: { category: "cloud_platform" }
  }]
};

test("readiness finding generator creates deterministic findings with evidence", () => {
  const findings = new ReadinessFindingGenerator().generate({
    matchResult,
    resume: { id: "resume-1" },
    jobDescription: { id: "job-1", position: "Software Engineer" }
  });
  assert.ok(findings.some((finding) => finding.category === "technical_skills"));
  assert.ok(findings.some((finding) => finding.category === "quantified_achievements"));
  assert.ok(findings.some((finding) => finding.severity === "weakness"));
  assert.ok(findings.every((finding) => finding.evidence.length > 0));
  assert.ok(findings.every((finding) => typeof finding.confidence === "number"));
});

test("recommendation generator references evidence for every recommendation", () => {
  const findings = new ReadinessFindingGenerator().generate({
    matchResult,
    resume: { id: "resume-1" },
    jobDescription: { id: "job-1" }
  });
  const recommendations = new ReadinessRecommendationGenerator().generate({ findings });
  assert.ok(recommendations.length > 0);
  assert.ok(recommendations.every((item) => item.evidenceRefs.length > 0));
  assert.ok(recommendations.some((item) => /Amazon Web Services/.test(item.text)));
});

test("readiness explanation pipeline cannot change deterministic decisions", async () => {
  const pipeline = new ReadinessExplanationPipeline({
    provider: {
      async explainReadiness({ findings, recommendations }) {
        return {
          findings: findings.map((finding) => ({ ...finding, severity: "strength" })),
          recommendations
        };
      }
    }
  });
  await assert.rejects(() => pipeline.run({
    findings: [{ category: "technical_skills", severity: "weakness", confidence: 0.8 }],
    recommendations: []
  }), /cannot change finding decisions/);
});
