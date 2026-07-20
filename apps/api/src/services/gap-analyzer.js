import { categoryForRequirement, normalizeMatchTerm } from "./matching-normalizer.js";

export class GapAnalyzer {
  analyze({ requirements, evidence, jobDescription }) {
    const matchedRequirementIds = new Set(evidence.map((item) => item.jobRequirementId));
    const metadata = jobDescription.parsedMetadata ?? {};
    const gaps = [];

    for (const requirement of requirements) {
      if (matchedRequirementIds.has(requirement.id)) continue;
      const category = categoryForRequirement(requirement);
      gaps.push({
        skill: requirement.text,
        normalizedSkill: normalizeMatchTerm(requirement.normalizedText ?? requirement.text),
        gapType: gapTypeFor(requirement),
        reason: reasonFor(requirement, category),
        importance: requirement.importance,
        confidence: Math.min(0.95, requirement.confidence ?? 0.8),
        metadata: {
          requirementId: requirement.id,
          category
        }
      });
    }

    for (const education of metadata.education ?? []) {
      if (!containsEvidence(evidence, education) && !gaps.some((gap) => gap.normalizedSkill.toLowerCase() === education.toLowerCase())) {
        gaps.push({
          skill: education,
          normalizedSkill: education,
          gapType: "missing_education",
          reason: "The job model includes an education requirement that was not found in visible canonical resume evidence.",
          importance: "medium",
          confidence: 0.74,
          metadata: { category: "education" }
        });
      }
    }

    for (const certification of metadata.certifications ?? []) {
      if (!containsEvidence(evidence, certification) && !gaps.some((gap) => gap.normalizedSkill.toLowerCase() === certification.toLowerCase())) {
        gaps.push({
          skill: certification,
          normalizedSkill: certification,
          gapType: "missing_certification",
          reason: "The job model includes a certification signal that was not found in visible canonical resume evidence.",
          importance: "medium",
          confidence: 0.76,
          metadata: { category: "certification" }
        });
      }
    }

    return gaps;
  }
}

function gapTypeFor(requirement) {
  if (requirement.requirementType === "responsibility") return "missing_experience";
  if (requirement.category === "certification") return "missing_certification";
  if (requirement.category === "education") return "missing_education";
  if (requirement.category === "keyword") return "missing_keyword";
  return requirement.importance === "high" ? "missing_skill" : "weak_skill";
}

function reasonFor(requirement, category) {
  if (requirement.requirementType === "responsibility") {
    return "No visible canonical resume bullet directly supports this responsibility.";
  }
  return `No visible canonical resume evidence matched the ${category.replace(/_/g, " ")} requirement.`;
}

function containsEvidence(evidence, value) {
  const normalized = String(value ?? "").toLowerCase();
  return evidence.some((item) => String(item.evidenceText ?? "").toLowerCase().includes(normalized));
}
