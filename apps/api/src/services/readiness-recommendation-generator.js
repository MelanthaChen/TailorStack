export class ReadinessRecommendationGenerator {
  generate({ findings }) {
    const recommendations = [];
    for (const finding of findings) {
      if (finding.severity === "strength") continue;
      const evidenceRefs = evidenceRefsFor(finding);
      recommendations.push({
        category: finding.category,
        priority: finding.severity === "weakness" ? "high" : "medium",
        text: recommendationText(finding),
        evidenceRefs,
        confidence: Math.min(0.92, Math.max(0.6, finding.confidence)),
        metadata: {
          sourceFindingCategory: finding.category,
          sourceFindingSeverity: finding.severity
        }
      });
    }
    return recommendations.slice(0, 10);
  }
}

function recommendationText(finding) {
  if (finding.category === "quantified_achievements") {
    return "Add measurable outcomes to existing truthful bullets where metrics are available";
  }
  if (finding.category === "leadership") {
    return "Clarify leadership, ownership, mentoring, or collaboration experience when already true";
  }
  if (finding.category === "projects") {
    return "Move a relevant project higher or make production deployment context easier to see";
  }
  const skill = finding.metadata?.normalizedSkill;
  if (skill) return `Mention ${skill} more clearly if it is already part of your experience`;
  return `Improve evidence coverage for ${finding.category.replace(/_/g, " ")}`;
}

function evidenceRefsFor(finding) {
  const refs = (finding.evidence ?? []).map((item) => ({
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    text: item.text
  }));
  if (refs.length) return refs;
  return [{
    sourceType: "readiness_finding",
    sourceId: null,
    text: finding.reason
  }];
}
