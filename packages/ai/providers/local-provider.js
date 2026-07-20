import { categoryForSkill, normalizeSkillName, relatedSkillsFor } from "../schemas/job-model.js";

export class LocalAIProvider {
  async enhanceJobModel({ deterministicModel }) {
    const normalizedSkills = dedupe([
      ...(deterministicModel.requiredSkills ?? []),
      ...(deterministicModel.preferredSkills ?? []),
      ...(deterministicModel.technologies ?? []),
      ...(deterministicModel.programmingLanguages ?? []),
      ...(deterministicModel.frameworks ?? []),
      ...(deterministicModel.cloudPlatforms ?? []),
      ...(deterministicModel.tools ?? []),
      ...(deterministicModel.softSkills ?? [])
    ].map(normalizeSkillName).filter(Boolean));

    const requirements = [];
    for (const skill of normalizedSkills) {
      const required = includesNormalized(deterministicModel.requiredSkills, skill);
      requirements.push({
        type: required ? "required_skill" : "preferred_skill",
        text: skill,
        normalizedText: skill,
        category: categoryForSkill(skill),
        importance: required ? "high" : "medium",
        weight: required ? 1 : 0.7,
        confidence: required ? 0.92 : 0.82,
        sourceSpan: null,
        metadata: {
          relatedSkills: relatedSkillsFor(skill)
        }
      });
    }
    for (const responsibility of deterministicModel.responsibilities ?? []) {
      requirements.push({
        type: "responsibility",
        text: responsibility,
        normalizedText: normalizeRequirementText(responsibility),
        category: "responsibility",
        importance: "medium",
        weight: 0.6,
        confidence: 0.78,
        sourceSpan: null,
        metadata: {}
      });
    }

    const keywords = dedupe([
      ...(deterministicModel.keywords ?? []),
      ...normalizedSkills,
      ...requirements.map((requirement) => requirement.category)
    ].map(normalizeKeyword).filter(Boolean)).map((keyword) => ({
      keyword,
      normalizedKeyword: keyword,
      importance: skillImportance(keyword, deterministicModel),
      weight: skillImportance(keyword, deterministicModel) === "high" ? 1 : 0.55,
      source: "ai_enhancement",
      confidence: 0.84,
      metadata: {}
    }));

    return {
      ...deterministicModel,
      normalizedSkills,
      inferredSkillGroups: groupSkills(normalizedSkills),
      requirements: dedupeRequirements(requirements),
      keywords
    };
  }

  async explainReadiness({ findings, recommendations }) {
    return {
      findings: findings.map((finding) => ({
        ...finding,
        reason: normalizeSentence(finding.reason)
      })),
      recommendations: recommendations.map((recommendation) => ({
        ...recommendation,
        text: normalizeSentence(recommendation.text)
      }))
    };
  }

  async proposeOptimizationWording({ patchIntent }) {
    const before = String(patchIntent.before ?? "").trim();
    if (patchIntent.operation === "replace_bullet" && before) {
      return {
        after: `${before} (${patchIntent.guidance})`,
        explanation: "Candidate wording preserves the original bullet and adds review guidance."
      };
    }
    if (patchIntent.operation === "replace_summary") {
      return {
        after: patchIntent.guidance,
        explanation: "Candidate summary wording is based on deterministic readiness findings."
      };
    }
    return {
      after: patchIntent.after ?? patchIntent.guidance,
      explanation: "Candidate wording is review-only and requires user approval."
    };
  }
}

function includesNormalized(values = [], skill) {
  return values.some((value) => normalizeSkillName(value).toLowerCase() === skill.toLowerCase());
}

function normalizeRequirementText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeKeyword(value) {
  return normalizeSkillName(String(value ?? "").replace(/[_-]/g, " ").trim());
}

function skillImportance(keyword, model) {
  return includesNormalized(model.requiredSkills, keyword) ? "high" : "medium";
}

function groupSkills(skills) {
  return skills.reduce((groups, skill) => {
    const category = categoryForSkill(skill);
    groups[category] = [...(groups[category] ?? []), skill];
    return groups;
  }, {});
}

function dedupe(values) {
  return [...new Map(values.map((value) => [String(value).toLowerCase(), value])).values()];
}

function dedupeRequirements(requirements) {
  return [...new Map(requirements.map((requirement) => [requirement.normalizedText.toLowerCase(), requirement])).values()];
}

function normalizeSentence(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
