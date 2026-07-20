import { categoryForRequirement, normalizeMatchTerm, normalizeText, relatedTermsFor } from "./matching-normalizer.js";

export class EvidenceGenerator {
  generate({ profile, requirements }) {
    const evidence = [];
    const skillMatches = [];

    for (const requirement of requirements) {
      const normalizedRequirement = normalizeMatchTerm(requirement.normalizedText ?? requirement.text);
      const requirementKey = normalizedRequirement.toLowerCase();
      const category = categoryForRequirement(requirement);
      const directBullet = profile.evidenceItems.find((item) => {
        return item.skills.some((skill) => skill.toLowerCase() === requirementKey)
          || item.normalizedText.includes(normalizeText(normalizedRequirement));
      });
      const relatedTerms = relatedTermsFor(normalizedRequirement);
      const relatedBullet = directBullet ? null : profile.evidenceItems.find((item) => {
        return relatedTerms.some((term) => item.normalizedText.includes(normalizeText(term)));
      });
      const matchedBy = directBullet ? "normalized_match" : relatedBullet ? "related_technology_match" : null;
      const item = directBullet ?? relatedBullet;
      if (!item || !matchedBy) continue;

      const confidence = matchedBy === "normalized_match" ? confidenceFor(requirement, 0.98) : confidenceFor(requirement, 0.72);
      const evidenceRecord = {
        id: crypto.randomUUID(),
        jobRequirementId: requirement.id,
        category,
        requirementText: requirement.normalizedText ?? requirement.text,
        matchedBy,
        sectionId: item.section.id,
        entityId: item.entity.id,
        bulletId: item.bullet.id,
        evidenceText: item.text,
        confidence,
        score: matchedBy === "normalized_match" ? 1 : 0.65,
        metadata: {
          entityTitle: item.entity.title,
          sectionTitle: item.section.title,
          relatedTerms
        }
      };
      evidence.push(evidenceRecord);
      if (category !== "responsibility") {
        skillMatches.push({
          id: crypto.randomUUID(),
          evidenceLocalId: evidenceRecord.id,
          skill: requirement.text,
          normalizedSkill: normalizedRequirement,
          category,
          matchType: matchedBy,
          confidence,
          score: evidenceRecord.score,
          metadata: {
            requirementId: requirement.id
          }
        });
      }
    }

    return { evidence, skillMatches };
  }
}

function confidenceFor(requirement, base) {
  return Math.min(0.99, Number(((requirement.confidence ?? 0.8) * base).toFixed(3)));
}
