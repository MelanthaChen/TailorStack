export const apiErrorCodes = Object.freeze({
  NOT_FOUND: "not_found",
  INTERNAL_ERROR: "internal_error",
  VALIDATION_ERROR: "validation_error",
  UNAUTHENTICATED: "unauthenticated",
  UNAUTHORIZED: "unauthorized",
  RATE_LIMITED: "rate_limited",
  CONFLICT: "conflict",
  INVALID_CREDENTIALS: "invalid_credentials"
});

export const jobStatuses = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled"
});

export const artifactFormats = Object.freeze({
  PDF: "pdf",
  DOCX: "docx",
  LATEX: "latex"
});

export const resumeStatuses = Object.freeze({
  PARSING: "parsing",
  REVIEW_REQUIRED: "review_required",
  ACTIVE: "active",
  ARCHIVED: "archived"
});

export const uploadedFileStatuses = Object.freeze({
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  ARCHIVED: "archived"
});

export function publicResume(resume) {
  if (!resume) return null;
  return {
    id: resume.id,
    title: resume.title,
    resumeType: resume.resumeType,
    status: resume.status,
    canonicalVersionId: resume.canonicalVersionId,
    sourceFileId: resume.sourceFileId,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt
  };
}

export function publicUpload(uploadedFile) {
  if (!uploadedFile) return null;
  return {
    id: uploadedFile.id,
    fileType: uploadedFile.fileType,
    originalFilename: uploadedFile.originalFilename,
    contentType: uploadedFile.contentType,
    byteSize: uploadedFile.byteSize,
    checksumSha256: uploadedFile.checksumSha256,
    status: uploadedFile.status,
    createdAt: uploadedFile.createdAt
  };
}

export function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    message: job.message,
    priority: job.priority,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

export function publicParsedSection(section) {
  return {
    id: section.id,
    sectionType: section.sectionType,
    title: section.title,
    displayOrder: section.displayOrder,
    visibility: section.visibility,
    source: section.source,
    confidence: section.confidence,
    metadata: section.metadata,
    entities: (section.entities ?? []).map(publicParsedEntity)
  };
}

export function publicParsedEntity(entity) {
  return {
    id: entity.id,
    entityType: entity.entityType,
    title: entity.title,
    organization: entity.organization,
    location: entity.location,
    startDate: entity.startDate,
    endDate: entity.endDate,
    datePrecision: entity.datePrecision,
    isCurrent: entity.isCurrent,
    url: entity.url,
    displayOrder: entity.displayOrder,
    visibility: entity.visibility,
    source: entity.source,
    confidence: entity.confidence,
    metadata: entity.metadata,
    bullets: (entity.bullets ?? []).map(publicParsedBullet)
  };
}

export function publicParsedBullet(bullet) {
  return {
    id: bullet.id,
    text: bullet.text,
    normalizedText: bullet.normalizedText,
    displayOrder: bullet.displayOrder,
    visibility: bullet.visibility,
    category: bullet.category,
    priority: bullet.priority,
    confidence: bullet.confidence,
    actionVerb: bullet.actionVerb,
    source: bullet.source,
    metadata: bullet.metadata,
    truthConstraints: bullet.truthConstraints
  };
}

export function publicResumeVersion(version) {
  if (!version) return null;
  return {
    id: version.id,
    resumeId: version.resumeId,
    parentVersionId: version.parentVersionId,
    versionType: version.versionType,
    name: version.name,
    targetCompany: version.targetCompany,
    targetRole: version.targetRole,
    jobDescriptionId: version.jobDescriptionId,
    status: version.status,
    diffId: version.diffId,
    resolvedSchemaHash: version.resolvedSchemaHash,
    metadata: version.metadata,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt
  };
}

export function publicResumeDiff(diff) {
  if (!diff) return null;
  return {
    id: diff.id,
    resumeId: diff.resumeId,
    baseVersionId: diff.baseVersionId,
    operationCount: diff.operationCount,
    operations: diff.operations,
    schemaVersion: diff.schemaVersion,
    createdAt: diff.createdAt
  };
}

export function publicJobDescription(jobDescription) {
  if (!jobDescription) return null;
  return {
    id: jobDescription.id,
    company: jobDescription.company,
    position: jobDescription.position,
    location: jobDescription.location,
    employmentType: jobDescription.employmentType,
    seniority: jobDescription.seniority,
    salary: jobDescription.salary,
    sourceUrl: jobDescription.sourceUrl,
    parseStatus: jobDescription.parseStatus,
    parseConfidence: jobDescription.parseConfidence,
    parsedMetadata: jobDescription.parsedMetadata,
    createdAt: jobDescription.createdAt,
    updatedAt: jobDescription.updatedAt
  };
}

export function publicJobRequirement(requirement) {
  if (!requirement) return null;
  return {
    id: requirement.id,
    jobDescriptionId: requirement.jobDescriptionId,
    requirementType: requirement.requirementType,
    text: requirement.text,
    normalizedText: requirement.normalizedText,
    importance: requirement.importance,
    weight: requirement.weight,
    category: requirement.category,
    confidence: requirement.confidence,
    metadata: requirement.metadata
  };
}

export function publicJobKeyword(keyword) {
  if (!keyword) return null;
  return {
    id: keyword.id,
    jobDescriptionId: keyword.jobDescriptionId,
    keyword: keyword.keyword,
    normalizedKeyword: keyword.normalizedKeyword,
    importance: keyword.importance,
    weight: keyword.weight,
    source: keyword.source,
    confidence: keyword.confidence,
    metadata: keyword.metadata
  };
}

export function publicMatchReport(report) {
  if (!report) return null;
  return {
    id: report.id,
    resumeId: report.resumeId,
    jobDescriptionId: report.jobDescriptionId,
    overallScore: report.overallScore,
    categoryScores: report.categoryScores,
    summary: report.summary,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

export function publicMatchEvidence(evidence) {
  if (!evidence) return null;
  return {
    id: evidence.id,
    matchReportId: evidence.matchReportId,
    jobRequirementId: evidence.jobRequirementId,
    category: evidence.category,
    requirementText: evidence.requirementText,
    matchedBy: evidence.matchedBy,
    sectionId: evidence.sectionId,
    entityId: evidence.entityId,
    bulletId: evidence.bulletId,
    evidenceText: evidence.evidenceText,
    confidence: evidence.confidence,
    score: evidence.score,
    metadata: evidence.metadata
  };
}

export function publicSkillMatch(match) {
  if (!match) return null;
  return {
    id: match.id,
    matchReportId: match.matchReportId,
    evidenceId: match.evidenceId,
    skill: match.skill,
    normalizedSkill: match.normalizedSkill,
    category: match.category,
    matchType: match.matchType,
    confidence: match.confidence,
    score: match.score,
    metadata: match.metadata
  };
}

export function publicSkillGap(gap) {
  if (!gap) return null;
  return {
    id: gap.id,
    matchReportId: gap.matchReportId,
    skill: gap.skill,
    normalizedSkill: gap.normalizedSkill,
    gapType: gap.gapType,
    reason: gap.reason,
    importance: gap.importance,
    confidence: gap.confidence,
    metadata: gap.metadata
  };
}

export function publicReadinessReport(report) {
  if (!report) return null;
  return {
    id: report.id,
    resumeId: report.resumeId,
    jobDescriptionId: report.jobDescriptionId,
    matchReportId: report.matchReportId,
    readinessScore: report.readinessScore,
    summary: report.summary,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

export function publicReadinessFinding(finding) {
  if (!finding) return null;
  return {
    id: finding.id,
    readinessReportId: finding.readinessReportId,
    category: finding.category,
    severity: finding.severity,
    evidence: finding.evidence,
    reason: finding.reason,
    confidence: finding.confidence,
    metadata: finding.metadata
  };
}

export function publicOptimizationRecommendation(recommendation) {
  if (!recommendation) return null;
  return {
    id: recommendation.id,
    readinessReportId: recommendation.readinessReportId,
    findingId: recommendation.findingId,
    category: recommendation.category,
    priority: recommendation.priority,
    text: recommendation.text,
    evidenceRefs: recommendation.evidenceRefs,
    confidence: recommendation.confidence,
    metadata: recommendation.metadata
  };
}

export function publicOptimizationPatchSet(patchSet) {
  if (!patchSet) return null;
  return {
    id: patchSet.id,
    resumeId: patchSet.resumeId,
    readinessReportId: patchSet.readinessReportId,
    matchReportId: patchSet.matchReportId,
    status: patchSet.status,
    patchCount: patchSet.patchCount,
    createdAt: patchSet.createdAt,
    updatedAt: patchSet.updatedAt
  };
}

export function publicOptimizationPatch(patch) {
  if (!patch) return null;
  return {
    id: patch.id,
    patchSetId: patch.patchSetId,
    operation: patch.operation,
    target: patch.target,
    reason: patch.reason,
    confidence: patch.confidence,
    evidence: patch.evidence,
    before: patch.before,
    after: patch.after,
    displayOrder: patch.displayOrder,
    metadata: patch.metadata
  };
}

export function publicPatchReviewState(reviewState) {
  if (!reviewState) return null;
  return {
    id: reviewState.id,
    patchSetId: reviewState.patchSetId,
    patchId: reviewState.patchId,
    state: reviewState.state,
    reviewedAt: reviewState.reviewedAt,
    createdAt: reviewState.createdAt,
    updatedAt: reviewState.updatedAt
  };
}

export function publicVersionSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    resumeId: snapshot.resumeId,
    versionId: snapshot.versionId,
    patchSetId: snapshot.patchSetId,
    snapshotHash: snapshot.snapshotHash,
    snapshot: snapshot.snapshot,
    createdAt: snapshot.createdAt
  };
}

export function publicRenderJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    resumeId: job.resumeId,
    versionId: job.versionId,
    format: job.format,
    status: job.status,
    resultRenderedResumeId: job.resultRenderedResumeId,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt
  };
}

export function publicRenderedResume(renderedResume) {
  if (!renderedResume) return null;
  return {
    id: renderedResume.id,
    resumeId: renderedResume.resumeId,
    versionId: renderedResume.versionId,
    renderJobId: renderedResume.renderJobId,
    format: renderedResume.format,
    contentType: renderedResume.contentType,
    byteSize: renderedResume.byteSize,
    createdAt: renderedResume.createdAt
  };
}

export function publicApplication(application) {
  if (!application) return null;
  return {
    id: application.id,
    company: application.company,
    position: application.position,
    jobDescriptionId: application.jobDescriptionId,
    resumeVersionId: application.resumeVersionId,
    matchReportId: application.matchReportId,
    readinessReportId: application.readinessReportId,
    optimizationPatchSetId: application.optimizationPatchSetId,
    renderedResumeId: application.renderedResumeId,
    status: application.status,
    metadata: application.metadata,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt
  };
}

export function publicApplicationEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    applicationId: event.applicationId,
    eventType: event.eventType,
    title: event.title,
    body: event.body,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    artifactRefs: event.artifactRefs,
    metadata: event.metadata,
    createdAt: event.createdAt
  };
}

export function publicApplicationNote(note) {
  if (!note) return null;
  return {
    id: note.id,
    applicationId: note.applicationId,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}

export function publicPromotionValidation(validation) {
  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings
  };
}

export function successResponse(data, requestId) {
  return {
    success: true,
    data,
    requestId
  };
}

export function errorResponse({ code, message, requestId, details }) {
  return {
    success: false,
    error: message,
    code,
    requestId,
    ...(details ? { details } : {})
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
