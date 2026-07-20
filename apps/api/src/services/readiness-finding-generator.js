export class ReadinessFindingGenerator {
  generate({ matchResult, resume, jobDescription }) {
    const findings = [];
    const categoryScores = matchResult.report.categoryScores ?? {};
    const evidence = matchResult.evidence ?? [];
    const gaps = matchResult.gaps ?? [];

    findings.push(overallCompletenessFinding(matchResult.report, resume, jobDescription));
    findings.push(technicalSkillsFinding(matchResult));
    findings.push(experienceAlignmentFinding(matchResult));
    findings.push(impactFinding(evidence));

    for (const [category, score] of Object.entries(categoryScores)) {
      const relatedEvidence = evidence.filter((item) => normalizeCategory(item.category) === normalizeCategory(category));
      const relatedGaps = gaps.filter((gap) => normalizeCategory(gap.metadata?.category ?? gap.gapType) === normalizeCategory(category));
      findings.push(categoryFinding(category, Number(score), relatedEvidence, relatedGaps));
    }

    if (gaps.length) {
      findings.push(...gaps.slice(0, 8).map(gapFinding));
    }

    findings.push(quantifiedImpactFinding(evidence));
    findings.push(leadershipFinding(evidence));
    findings.push(projectsFinding(evidence, gaps));

    return dedupeFindings(findings.filter(Boolean));
  }
}

function technicalSkillsFinding(matchResult) {
  const technicalMatches = (matchResult.skillMatches ?? []).filter((item) => {
    return ["programming_language", "framework", "cloud_platform", "tool", "database"].includes(item.category);
  });
  const technicalGaps = (matchResult.gaps ?? []).filter((gap) => {
    return ["programming_language", "framework", "cloud_platform", "tool", "database"].includes(gap.metadata?.category);
  });
  return {
    category: "technical_skills",
    severity: technicalMatches.length >= technicalGaps.length ? "strength" : "weakness",
    evidence: technicalMatches.length
      ? technicalMatches.slice(0, 4).map((item) => ({
        sourceType: "skill_match",
        sourceId: item.id,
        text: `${item.normalizedSkill} matched by ${item.matchType}`,
        confidence: item.confidence
      }))
      : fallbackEvidence(technicalGaps.slice(0, 4).map(gapRef), "No technical skill matches were found."),
    reason: technicalMatches.length >= technicalGaps.length
      ? "Technical requirements have more matched evidence than gaps"
      : "Technical requirements have more gaps than matched evidence",
    confidence: 0.84,
    metadata: { technicalMatchCount: technicalMatches.length, technicalGapCount: technicalGaps.length }
  };
}

function experienceAlignmentFinding(matchResult) {
  const experienceEvidence = (matchResult.evidence ?? []).filter((item) => item.category === "responsibility" || /experience/i.test(item.metadata?.sectionTitle ?? ""));
  const experienceGaps = (matchResult.gaps ?? []).filter((gap) => gap.gapType === "missing_experience");
  return {
    category: "experience_alignment",
    severity: experienceGaps.length ? "warning" : "strength",
    evidence: experienceEvidence.length
      ? experienceEvidence.slice(0, 3).map(evidenceRef)
      : fallbackEvidence(experienceGaps.slice(0, 3).map(gapRef), "No direct responsibility evidence was found."),
    reason: experienceGaps.length
      ? "Some job responsibilities are not directly supported by visible resume bullets"
      : "Job responsibilities are supported by visible resume evidence",
    confidence: experienceEvidence.length ? 0.8 : 0.7,
    metadata: { experienceEvidenceCount: experienceEvidence.length, experienceGapCount: experienceGaps.length }
  };
}

function impactFinding(evidence) {
  const impactEvidence = evidence.filter((item) => /built|improved|reduced|increased|launched|delivered|optimized/i.test(item.evidenceText ?? ""));
  return {
    category: "impact",
    severity: impactEvidence.length ? "strength" : "warning",
    evidence: impactEvidence.length
      ? impactEvidence.slice(0, 3).map(evidenceRef)
      : [{ sourceType: "readiness_engine", sourceId: null, text: "Matched evidence does not clearly emphasize delivered impact.", confidence: 0.64 }],
    reason: impactEvidence.length
      ? "Matched evidence includes action-oriented impact language"
      : "Matched evidence could make delivered impact easier to identify",
    confidence: impactEvidence.length ? 0.78 : 0.64,
    metadata: { impactEvidenceCount: impactEvidence.length }
  };
}

function overallCompletenessFinding(report, resume, jobDescription) {
  const score = Number(report.overallScore ?? 0);
  return {
    category: "overall_completeness",
    severity: score >= 75 ? "strength" : score >= 50 ? "warning" : "weakness",
    evidence: [{
      sourceType: "match_report",
      sourceId: report.id,
      text: `Overall deterministic match score is ${score}% for ${jobDescription.position ?? "the target role"}.`
    }],
    reason: score >= 75
      ? "The canonical resume has broad coverage across the normalized job model"
      : "The canonical resume has important gaps against the normalized job model",
    confidence: 0.9,
    metadata: {
      resumeId: resume.id,
      jobDescriptionId: jobDescription.id,
      score
    }
  };
}

function categoryFinding(category, score, evidence, gaps) {
  return {
    category: displayCategory(category),
    severity: score >= 80 ? "strength" : score >= 50 ? "warning" : "weakness",
    evidence: evidence.length
      ? evidence.slice(0, 3).map((item) => evidenceRef(item))
      : fallbackEvidence(gaps.slice(0, 3).map((gap) => gapRef(gap)), `${displayCategory(category)} category score is ${score}%.`),
    reason: score >= 80
      ? `${displayCategory(category)} is well supported by resume evidence`
      : `${displayCategory(category)} has incomplete support in the visible canonical resume`,
    confidence: evidence.length ? 0.86 : 0.78,
    metadata: { score, gapCount: gaps.length }
  };
}

function gapFinding(gap) {
  return {
    category: displayCategory(gap.metadata?.category ?? gap.gapType),
    severity: gap.importance === "high" ? "weakness" : "warning",
    evidence: [gapRef(gap)],
    reason: gap.reason,
    confidence: gap.confidence,
    metadata: {
      gapType: gap.gapType,
      normalizedSkill: gap.normalizedSkill
    }
  };
}

function quantifiedImpactFinding(evidence) {
  const quantified = evidence.filter((item) => /\b\d+[%x]?\b|\$[0-9]|million|thousand/i.test(item.evidenceText ?? ""));
  return {
    category: "quantified_achievements",
    severity: quantified.length ? "strength" : "warning",
    evidence: quantified.length
      ? quantified.slice(0, 3).map(evidenceRef)
      : [{ sourceType: "match_report", sourceId: null, text: "No matched evidence includes clear metrics or measurable outcomes." }],
    reason: quantified.length
      ? "Matched resume evidence includes measurable outcomes"
      : "Matched resume evidence does not show measurable impact clearly",
    confidence: quantified.length ? 0.84 : 0.72,
    metadata: { quantifiedEvidenceCount: quantified.length }
  };
}

function leadershipFinding(evidence) {
  const leadership = evidence.filter((item) => /lead|mentor|own|collaborat|stakeholder/i.test(item.evidenceText ?? ""));
  return {
    category: "leadership",
    severity: leadership.length ? "strength" : "warning",
    evidence: leadership.length
      ? leadership.slice(0, 3).map(evidenceRef)
      : [{ sourceType: "match_report", sourceId: null, text: "No matched evidence explicitly demonstrates leadership or mentorship." }],
    reason: leadership.length
      ? "Matched evidence includes leadership, ownership, or collaboration signals"
      : "Leadership signals are not explicit in matched resume evidence",
    confidence: leadership.length ? 0.82 : 0.68,
    metadata: { leadershipEvidenceCount: leadership.length }
  };
}

function projectsFinding(evidence, gaps) {
  const projectEvidence = evidence.filter((item) => /project/i.test(item.category) || /project/i.test(item.metadata?.sectionTitle ?? ""));
  const projectGaps = gaps.filter((gap) => /project/i.test(gap.gapType) || /project/i.test(gap.reason));
  return {
    category: "projects",
    severity: projectEvidence.length || !projectGaps.length ? "strength" : "warning",
    evidence: projectEvidence.length
      ? projectEvidence.slice(0, 3).map(evidenceRef)
      : fallbackEvidence(projectGaps.slice(0, 3).map(gapRef), "No strong project-specific match evidence was found."),
    reason: projectEvidence.length
      ? "Project evidence is visible in the match report"
      : "Project alignment is not strongly represented in matched evidence",
    confidence: projectEvidence.length ? 0.78 : 0.62,
    metadata: { projectEvidenceCount: projectEvidence.length }
  };
}

function evidenceRef(item) {
  return {
    sourceType: "match_evidence",
    sourceId: item.id,
    text: item.evidenceText,
    confidence: item.confidence
  };
}

function gapRef(gap) {
  return {
    sourceType: "skill_gap",
    sourceId: gap.id,
    text: `${gap.normalizedSkill}: ${gap.reason}`,
    confidence: gap.confidence
  };
}

function fallbackEvidence(evidence, text) {
  return evidence.length ? evidence : [{ sourceType: "readiness_engine", sourceId: null, text, confidence: 0.6 }];
}

function normalizeCategory(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function displayCategory(value) {
  return String(value ?? "keywords").replace(/-/g, "_").replace(/\s+/g, "_").toLowerCase();
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.category}:${finding.severity}:${finding.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
