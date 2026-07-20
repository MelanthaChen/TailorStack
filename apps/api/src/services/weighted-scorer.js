export class WeightedScorer {
  score({ requirements, evidence, gaps }) {
    const evidenceByRequirement = new Map(evidence.map((item) => [item.jobRequirementId, item]));
    const categoryTotals = new Map();
    const categoryScores = new Map();

    for (const requirement of requirements) {
      const category = categoryKey(requirement);
      const weight = Number(requirement.weight ?? 0.5);
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + weight);
      const matched = evidenceByRequirement.get(requirement.id);
      if (matched) {
        categoryScores.set(category, (categoryScores.get(category) ?? 0) + weight * matched.score);
      }
    }

    const breakdown = {};
    for (const [category, total] of categoryTotals) {
      breakdown[category] = total ? Math.round(((categoryScores.get(category) ?? 0) / total) * 100) : 0;
    }

    const weightedTotal = [...categoryTotals.values()].reduce((sum, value) => sum + value, 0);
    const weightedScore = [...categoryScores.values()].reduce((sum, value) => sum + value, 0);
    const overallScore = weightedTotal ? Math.round((weightedScore / weightedTotal) * 100) : 0;

    return {
      overallScore,
      categoryScores: breakdown,
      summary: {
        matchedRequirementCount: evidenceByRequirement.size,
        totalRequirementCount: requirements.length,
        gapCount: gaps.length
      }
    };
  }
}

function categoryKey(requirement) {
  if (requirement.category === "programming_language") return "programming_languages";
  if (requirement.category === "cloud_platform") return "cloud_platforms";
  return String(requirement.category || requirement.requirementType || "keywords").replace(/-/g, "_");
}
