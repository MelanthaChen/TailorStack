import { applicationStatuses } from "../repositories/application.repository.js";

export class ApplicationService {
  constructor({
    applicationRepository,
    versioningRepository,
    jobDescriptionRepository,
    matchRepository,
    readinessRepository,
    patchRepository,
    timelineService,
    logger
  }) {
    this.applicationRepository = applicationRepository;
    this.versioningRepository = versioningRepository;
    this.jobDescriptionRepository = jobDescriptionRepository;
    this.matchRepository = matchRepository;
    this.readinessRepository = readinessRepository;
    this.patchRepository = patchRepository;
    this.timelineService = timelineService;
    this.logger = logger;
  }

  async create({ user, input, requestId }) {
    this.logger.info("application_create_started", { requestId, userId: user.id, resumeVersionId: input.resumeVersionId });
    const normalized = normalizeCreateInput(input);
    await this.validateArtifactRefs(user.id, normalized);
    const application = await this.applicationRepository.createApplication({
      userId: user.id,
      ...normalized
    });
    this.logger.info("application_create_succeeded", { requestId, userId: user.id, applicationId: application.id });
    return this.get({ user, applicationId: application.id, requestId });
  }

  async list({ user, requestId }) {
    this.logger.info("application_list_started", { requestId, userId: user.id });
    const applications = await this.applicationRepository.listApplications(user.id);
    this.logger.info("application_list_succeeded", { requestId, userId: user.id, applicationCount: applications.length });
    return applications;
  }

  async get({ user, applicationId, requestId }) {
    this.logger.info("application_get_started", { requestId, userId: user.id, applicationId });
    const application = await this.applicationRepository.findApplicationForUser(user.id, applicationId);
    if (!application) throwNotFound("Application not found");
    const events = await this.applicationRepository.listEvents(user.id, applicationId);
    const notes = await this.applicationRepository.listNotes(user.id, applicationId);
    this.logger.info("application_get_succeeded", { requestId, userId: user.id, applicationId });
    return { application, events, notes };
  }

  async updateStatus({ user, applicationId, status, requestId }) {
    const normalizedStatus = normalizeStatus(status);
    this.logger.info("application_status_update_started", { requestId, userId: user.id, applicationId, status: normalizedStatus });
    const current = await this.applicationRepository.findApplicationForUser(user.id, applicationId);
    if (!current) throwNotFound("Application not found");
    if (current.status === normalizedStatus) {
      return this.get({ user, applicationId, requestId });
    }
    const updated = await this.applicationRepository.updateStatus({
      userId: user.id,
      applicationId,
      status: normalizedStatus
    });
    await this.timelineService.recordStatusChange({
      user,
      application: updated,
      fromStatus: current.status,
      toStatus: normalizedStatus,
      requestId
    });
    this.logger.info("application_status_update_succeeded", { requestId, userId: user.id, applicationId, status: normalizedStatus });
    return this.get({ user, applicationId, requestId });
  }

  async validateArtifactRefs(userId, input) {
    const version = await this.versioningRepository.findVersionForUser(userId, input.resumeVersionId);
    if (!version) throwValidation("Resume version is required");
    if (input.jobDescriptionId && !(await this.jobDescriptionRepository.findForUser(input.jobDescriptionId, userId))) {
      throwValidation("Job description reference is invalid");
    }
    if (input.matchReportId && !(await this.matchRepository.findReportForUser(input.matchReportId, userId))) {
      throwValidation("Match report reference is invalid");
    }
    if (input.readinessReportId && !(await this.readinessRepository.findReportForUser(input.readinessReportId, userId))) {
      throwValidation("Readiness report reference is invalid");
    }
    if (input.optimizationPatchSetId && !(await this.patchRepository.findPatchSetForUser(input.optimizationPatchSetId, userId))) {
      throwValidation("Optimization patch set reference is invalid");
    }
    if (input.renderedResumeId) {
      const rendered = await this.versioningRepository.findRenderedForUser(userId, input.renderedResumeId);
      if (!rendered || rendered.versionId !== input.resumeVersionId) throwValidation("Rendered resume reference is invalid");
    }
  }
}

function normalizeCreateInput(input = {}) {
  const company = String(input.company ?? "").trim();
  if (!company) throwValidation("Company is required");
  const resumeVersionId = String(input.resumeVersionId ?? "").trim();
  if (!resumeVersionId) throwValidation("Resume version is required");
  return {
    company,
    position: nullableString(input.position),
    jobDescriptionId: nullableString(input.jobDescriptionId),
    resumeVersionId,
    matchReportId: nullableString(input.matchReportId),
    readinessReportId: nullableString(input.readinessReportId),
    optimizationPatchSetId: nullableString(input.optimizationPatchSetId),
    renderedResumeId: nullableString(input.renderedResumeId),
    status: normalizeStatus(input.status ?? "draft"),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
  };
}

function normalizeStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (!applicationStatuses.includes(normalized)) throwValidation("Invalid application status");
  return normalized;
}

function nullableString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function throwNotFound(message) {
  const error = new Error(message);
  error.code = "not_found";
  error.statusCode = 404;
  throw error;
}

function throwValidation(message) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 422;
  throw error;
}
