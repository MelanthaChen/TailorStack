import { loadConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import { apiErrorCodes } from "../../../packages/schemas/src/index.js";
import { AuthController } from "./controllers/auth.controller.js";
import { DraftReviewController } from "./controllers/draft-review.controller.js";
import { JobDescriptionController } from "./controllers/job-description.controller.js";
import { MatchController } from "./controllers/match.controller.js";
import { ReadinessController } from "./controllers/readiness.controller.js";
import { OptimizationController } from "./controllers/optimization.controller.js";
import { VersioningController } from "./controllers/versioning.controller.js";
import { ApplicationController } from "./controllers/application.controller.js";
import { ResumeParserController } from "./controllers/resume-parser.controller.js";
import { ResumeEditorController } from "./controllers/resume-editor.controller.js";
import { ResumeUploadController } from "./controllers/resume-upload.controller.js";
import { sendError, sendSuccess } from "./http/response.js";
import { getPathname } from "./http/request.js";
import { attachCurrentUser } from "./middleware/auth.js";
import { createAsyncJobRepository } from "./repositories/async-job.repository.js";
import { createAuthRepository } from "./repositories/auth.repository.js";
import { createResumeRepository } from "./repositories/resume.repository.js";
import { createResumeParserRepository } from "./repositories/resume-parser.repository.js";
import { createUploadedFileRepository } from "./repositories/uploaded-file.repository.js";
import { createPromotionRepository } from "./repositories/promotion.repository.js";
import { createAuditRepository } from "./repositories/audit.repository.js";
import { createResumeEditorRepository } from "./repositories/resume-editor.repository.js";
import { createJobDescriptionRepository } from "./repositories/job-description.repository.js";
import { createJobKeywordRepository } from "./repositories/job-keyword.repository.js";
import { createJobRequirementRepository } from "./repositories/job-requirement.repository.js";
import { createMatchRepository } from "./repositories/match.repository.js";
import { createReadinessRepository } from "./repositories/readiness.repository.js";
import { createPatchRepository } from "./repositories/patch.repository.js";
import { createVersioningRepository } from "./repositories/versioning.repository.js";
import { createApplicationRepository } from "./repositories/application.repository.js";
import { AuthService } from "./services/auth.service.js";
import { AiResumeParserService } from "./services/ai-resume-parser.service.js";
import { PdfExtractionService } from "./services/pdf-extraction.service.js";
import { ResumeParserService } from "./services/resume-parser.service.js";
import { ResumeUploadService } from "./services/resume-upload.service.js";
import { CanonicalResumeResolver } from "./services/canonical-resume-resolver.js";
import { DraftPromotionService } from "./services/draft-promotion.service.js";
import { ResumeEditorService } from "./services/resume-editor.service.js";
import { JobDescriptionService } from "./services/job-description.service.js";
import { MatchingService } from "./services/matching.service.js";
import { ReadinessService } from "./services/readiness.service.js";
import { OptimizationService } from "./services/optimization.service.js";
import { ReviewStateService } from "./services/review-state.service.js";
import { VersionBuilderService } from "./services/version-builder.service.js";
import { ApplicationService } from "./services/application.service.js";
import { TimelineService } from "./services/timeline.service.js";
import { NotesService } from "./services/notes.service.js";
import { validateResumeUpload } from "./services/upload-validation.js";
import { createObjectStorage } from "../../../packages/object-storage/src/index.js";
import { RepositoryBackedQueue } from "../../../packages/queue/src/index.js";

export function createApp(options = {}) {
  const config = { ...loadConfig(), ...(options.config ?? {}) };
  const logger = options.logger ?? createLogger({ level: config.logLevel });
  const rateLimiter = options.rateLimiter ?? new InMemoryRateLimiter({
    windowMs: config.rateLimitWindowMs ?? 60_000,
    maxRequests: config.rateLimitMaxRequests ?? 120
  });
  const defaultRepositories = {
    auth: createAuthRepository(config),
    uploadedFiles: createUploadedFileRepository(config),
    resumes: createResumeRepository(config),
    asyncJobs: createAsyncJobRepository(config),
    resumeParser: createResumeParserRepository(config),
    jobDescriptions: createJobDescriptionRepository(config),
    jobRequirements: createJobRequirementRepository(config),
    jobKeywords: createJobKeywordRepository(config),
    matches: createMatchRepository(config),
    readiness: createReadinessRepository(config),
    patches: createPatchRepository(config),
    versioning: null,
    applications: createApplicationRepository(config)
  };
  const repositories = {
    ...defaultRepositories,
    ...(options.repositories ?? {})
  };
  if (!repositories.promotion) {
    repositories.promotion = createPromotionRepository(config, {
      resumeRepository: repositories.resumes
    });
  }
  if (!repositories.audit) {
    repositories.audit = createAuditRepository(config, { promotionRepository: repositories.promotion });
  }
  if (!repositories.resumeEditor) {
    repositories.resumeEditor = createResumeEditorRepository(config, { resumeParserRepository: repositories.resumeParser });
  }
  if (!repositories.versioning) {
    repositories.versioning = createVersioningRepository(config, { promotionRepository: repositories.promotion });
  }
  const objectStorage = options.objectStorage ?? createObjectStorage(config);
  const queue = options.queue ?? new RepositoryBackedQueue({ jobRepository: repositories.asyncJobs });
  const authService = options.authService ?? new AuthService({
    authRepository: repositories.auth,
    config,
    logger
  });
  const authController = options.authController ?? new AuthController({ authService, config });
  const resumeUploadService = options.resumeUploadService ?? new ResumeUploadService({
    uploadedFileRepository: repositories.uploadedFiles,
    resumeRepository: repositories.resumes,
    queue,
    objectStorage,
    config,
    logger,
    validateUpload: validateResumeUpload
  });
  const resumeUploadController = options.resumeUploadController ?? new ResumeUploadController({
    resumeUploadService,
    config
  });
  const resumeParserService = options.resumeParserService ?? new ResumeParserService({
    asyncJobRepository: repositories.asyncJobs,
    resumeRepository: repositories.resumes,
    uploadedFileRepository: repositories.uploadedFiles,
    resumeParserRepository: repositories.resumeParser,
    objectStorage,
    pdfExtractionService: options.pdfExtractionService ?? new PdfExtractionService(),
    aiResumeParserService: options.aiResumeParserService ?? new AiResumeParserService(),
    logger
  });
  const resumeParserController = options.resumeParserController ?? new ResumeParserController({
    resumeParserService
  });
  const canonicalResumeResolver = options.canonicalResumeResolver ?? new CanonicalResumeResolver({
    resumeRepository: repositories.resumes,
    promotionRepository: repositories.promotion,
    resumeParserRepository: repositories.resumeParser
  });
  const draftPromotionService = options.draftPromotionService ?? new DraftPromotionService({
    resumeRepository: repositories.resumes,
    resumeParserRepository: repositories.resumeParser,
    asyncJobRepository: repositories.asyncJobs,
    promotionRepository: repositories.promotion,
    canonicalResumeResolver,
    logger
  });
  const draftReviewController = options.draftReviewController ?? new DraftReviewController({
    draftPromotionService
  });
  const resumeEditorService = options.resumeEditorService ?? new ResumeEditorService({
    resumeRepository: repositories.resumes,
    resumeParserRepository: repositories.resumeParser,
    resumeEditorRepository: repositories.resumeEditor,
    auditRepository: repositories.audit,
    logger
  });
  const resumeEditorController = options.resumeEditorController ?? new ResumeEditorController({
    resumeEditorService
  });
  const jobDescriptionService = options.jobDescriptionService ?? new JobDescriptionService({
    jobDescriptionRepository: repositories.jobDescriptions,
    jobRequirementRepository: repositories.jobRequirements,
    jobKeywordRepository: repositories.jobKeywords,
    logger
  });
  const jobDescriptionController = options.jobDescriptionController ?? new JobDescriptionController({
    jobDescriptionService
  });
  const matchingService = options.matchingService ?? new MatchingService({
    resumeRepository: repositories.resumes,
    resumeParserRepository: repositories.resumeParser,
    jobDescriptionRepository: repositories.jobDescriptions,
    jobRequirementRepository: repositories.jobRequirements,
    jobKeywordRepository: repositories.jobKeywords,
    matchRepository: repositories.matches,
    logger
  });
  const matchController = options.matchController ?? new MatchController({
    matchingService
  });
  const readinessService = options.readinessService ?? new ReadinessService({
    resumeRepository: repositories.resumes,
    jobDescriptionRepository: repositories.jobDescriptions,
    matchRepository: repositories.matches,
    readinessRepository: repositories.readiness,
    logger
  });
  const readinessController = options.readinessController ?? new ReadinessController({
    readinessService
  });
  const optimizationService = options.optimizationService ?? new OptimizationService({
    resumeRepository: repositories.resumes,
    resumeParserRepository: repositories.resumeParser,
    readinessRepository: repositories.readiness,
    matchRepository: repositories.matches,
    patchRepository: repositories.patches,
    logger
  });
  const reviewStateService = options.reviewStateService ?? new ReviewStateService({
    patchRepository: repositories.patches,
    logger
  });
  const optimizationController = options.optimizationController ?? new OptimizationController({
    optimizationService,
    reviewStateService
  });
  const versionBuilderService = options.versionBuilderService ?? new VersionBuilderService({
    resumeRepository: repositories.resumes,
    resumeParserRepository: repositories.resumeParser,
    patchRepository: repositories.patches,
    versioningRepository: repositories.versioning,
    logger
  });
  const versioningController = options.versioningController ?? new VersioningController({
    versionBuilderService
  });
  const timelineService = options.timelineService ?? new TimelineService({
    applicationRepository: repositories.applications,
    logger
  });
  const applicationService = options.applicationService ?? new ApplicationService({
    applicationRepository: repositories.applications,
    versioningRepository: repositories.versioning,
    jobDescriptionRepository: repositories.jobDescriptions,
    matchRepository: repositories.matches,
    readinessRepository: repositories.readiness,
    patchRepository: repositories.patches,
    timelineService,
    logger
  });
  const notesService = options.notesService ?? new NotesService({
    applicationRepository: repositories.applications,
    timelineService,
    logger
  });
  const applicationController = options.applicationController ?? new ApplicationController({
    applicationService,
    notesService
  });

  return async function handleRequest(req, res) {
    const startedAt = Date.now();
    const requestId = req.headers["x-request-id"] ?? crypto.randomUUID();
    const pathname = getPathname(req);
    let currentUserId = null;

    res.setHeader("x-request-id", requestId);
    res.setHeader("content-type", "application/json; charset=utf-8");
    setSecurityHeaders(res);
    res.setHeader("access-control-allow-origin", config.webOrigin);
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("access-control-allow-headers", "content-type,x-request-id");
    res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      enforceRequestLimits(req, config);
      enforceContentType(req, pathname);
      const rate = rateLimiter.check(clientKey(req));
      if (!rate.allowed) {
        sendError(res, 429, apiErrorCodes.RATE_LIMITED, "Too many requests", requestId);
        return;
      }
      const context = {
        req,
        res,
        config,
        logger,
        repositories,
        requestId
      };

      await attachCurrentUser(context);
      currentUserId = context.currentUser?.id ?? null;

      if (req.method === "GET" && pathname === "/healthz") {
        sendSuccess(res, 200, {
          status: "ok",
          service: config.serviceName ?? "tailorstack-api",
          environment: config.appEnv,
          timestamp: new Date().toISOString(),
          database: config.authRepositoryDriver === "memory" ? "memory" : "configured",
          uptimeSeconds: Math.round(process.uptime())
        }, requestId);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/auth/signup") {
        await authController.signup(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/auth/login") {
        await authController.login(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/auth/logout") {
        await authController.logout(context);
        return;
      }

      if (req.method === "GET" && pathname === "/v1/auth/me") {
        await authController.currentUser(context);
        return;
      }

      if (req.method === "GET" && pathname === "/v1/protected/status") {
        await authController.protectedStatus(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/job-descriptions") {
        await jobDescriptionController.create(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/job-descriptions/text-upload") {
        await jobDescriptionController.uploadText(context);
        return;
      }

      if (req.method === "GET" && pathname === "/v1/job-descriptions") {
        await jobDescriptionController.list(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/match-reports") {
        await matchController.create(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/readiness-reports") {
        await readinessController.create(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/optimization-patch-sets") {
        await optimizationController.create(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/resume-versions") {
        await versioningController.create(context);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/applications") {
        await applicationController.create(context);
        return;
      }

      if (req.method === "GET" && pathname === "/v1/applications") {
        await applicationController.list(context);
        return;
      }

      const applicationStatusMatch = /^\/v1\/applications\/([^/]+)\/status$/.exec(pathname);
      if (req.method === "POST" && applicationStatusMatch) {
        await applicationController.updateStatus(context, applicationStatusMatch[1]);
        return;
      }

      const applicationNotesMatch = /^\/v1\/applications\/([^/]+)\/notes$/.exec(pathname);
      if (req.method === "POST" && applicationNotesMatch) {
        await applicationController.createNote(context, applicationNotesMatch[1]);
        return;
      }

      const applicationMatch = /^\/v1\/applications\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && applicationMatch) {
        await applicationController.get(context, applicationMatch[1]);
        return;
      }

      const resumeVersionsMatch = /^\/v1\/resumes\/([^/]+)\/versions$/.exec(pathname);
      if (req.method === "GET" && resumeVersionsMatch) {
        await versioningController.list(context, resumeVersionsMatch[1]);
        return;
      }

      const resumeVersionMatch = /^\/v1\/resume-versions\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && resumeVersionMatch) {
        await versioningController.get(context, resumeVersionMatch[1]);
        return;
      }

      const renderedResumeMatch = /^\/v1\/rendered-resumes\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && renderedResumeMatch) {
        await versioningController.artifact(context, renderedResumeMatch[1]);
        return;
      }

      const optimizationPatchSetReviewMatch = /^\/v1\/optimization-patch-sets\/([^/]+)\/review$/.exec(pathname);
      if (req.method === "POST" && optimizationPatchSetReviewMatch) {
        await optimizationController.reviewPatchSet(context, optimizationPatchSetReviewMatch[1]);
        return;
      }

      const optimizationPatchSetMatch = /^\/v1\/optimization-patch-sets\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && optimizationPatchSetMatch) {
        await optimizationController.get(context, optimizationPatchSetMatch[1]);
        return;
      }

      const optimizationPatchReviewMatch = /^\/v1\/optimization-patches\/([^/]+)\/review$/.exec(pathname);
      if (req.method === "POST" && optimizationPatchReviewMatch) {
        await optimizationController.reviewPatch(context, optimizationPatchReviewMatch[1]);
        return;
      }

      const readinessReportMatch = /^\/v1\/readiness-reports\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && readinessReportMatch) {
        await readinessController.get(context, readinessReportMatch[1]);
        return;
      }

      const matchReportMatch = /^\/v1\/match-reports\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && matchReportMatch) {
        await matchController.get(context, matchReportMatch[1]);
        return;
      }

      const jobDescriptionMatch = /^\/v1\/job-descriptions\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && jobDescriptionMatch) {
        await jobDescriptionController.get(context, jobDescriptionMatch[1]);
        return;
      }

      if (req.method === "POST" && pathname === "/v1/resumes/uploads") {
        await resumeUploadController.upload(context);
        return;
      }

      if (req.method === "GET" && pathname === "/v1/resumes") {
        await resumeUploadController.list(context);
        return;
      }

      const statusMatch = /^\/v1\/resumes\/([^/]+)\/upload-status$/.exec(pathname);
      if (req.method === "GET" && statusMatch) {
        await resumeUploadController.status(context, statusMatch[1]);
        return;
      }

      const previewMatch = /^\/v1\/resumes\/([^/]+)\/parsed-draft$/.exec(pathname);
      if (req.method === "GET" && previewMatch) {
        await resumeParserController.preview(context, previewMatch[1]);
        return;
      }

      const runParseMatch = /^\/v1\/parse-jobs\/([^/]+)\/run$/.exec(pathname);
      if (req.method === "POST" && runParseMatch) {
        await resumeParserController.run(context, runParseMatch[1]);
        return;
      }

      const retryParseMatch = /^\/v1\/parse-jobs\/([^/]+)\/retry$/.exec(pathname);
      if (req.method === "POST" && retryParseMatch) {
        await resumeParserController.retry(context, retryParseMatch[1]);
        return;
      }

      const reviewMatch = /^\/v1\/resumes\/([^/]+)\/draft-review$/.exec(pathname);
      if (req.method === "GET" && reviewMatch) {
        await draftReviewController.review(context, reviewMatch[1]);
        return;
      }

      const approveMatch = /^\/v1\/resumes\/([^/]+)\/promote$/.exec(pathname);
      if (req.method === "POST" && approveMatch) {
        await draftReviewController.approve(context, approveMatch[1]);
        return;
      }

      const rejectMatch = /^\/v1\/resumes\/([^/]+)\/reject-draft$/.exec(pathname);
      if (req.method === "POST" && rejectMatch) {
        await draftReviewController.reject(context, rejectMatch[1]);
        return;
      }

      const editorMatch = /^\/v1\/resumes\/([^/]+)\/canonical$/.exec(pathname);
      if (req.method === "GET" && editorMatch) {
        await resumeEditorController.get(context, editorMatch[1]);
        return;
      }

      if (req.method === "POST" && editorMatch) {
        await resumeEditorController.createSection(context, editorMatch[1]);
        return;
      }

      const sectionReorderMatch = /^\/v1\/resumes\/([^/]+)\/sections\/reorder$/.exec(pathname);
      if (req.method === "POST" && sectionReorderMatch) {
        await resumeEditorController.reorderSections(context, sectionReorderMatch[1]);
        return;
      }

      const sectionMatch = /^\/v1\/sections\/([^/]+)$/.exec(pathname);
      if (sectionMatch && req.method === "PATCH") {
        await resumeEditorController.updateSection(context, sectionMatch[1]);
        return;
      }
      if (sectionMatch && req.method === "DELETE") {
        await resumeEditorController.deleteSection(context, sectionMatch[1]);
        return;
      }

      const sectionVisibilityMatch = /^\/v1\/sections\/([^/]+)\/visibility$/.exec(pathname);
      if (sectionVisibilityMatch && req.method === "POST") {
        await resumeEditorController.sectionVisibility(context, sectionVisibilityMatch[1]);
        return;
      }

      const sectionEntitiesMatch = /^\/v1\/sections\/([^/]+)\/entities$/.exec(pathname);
      if (sectionEntitiesMatch && req.method === "POST") {
        await resumeEditorController.createEntity(context, sectionEntitiesMatch[1]);
        return;
      }

      const entityReorderMatch = /^\/v1\/sections\/([^/]+)\/entities\/reorder$/.exec(pathname);
      if (entityReorderMatch && req.method === "POST") {
        await resumeEditorController.reorderEntities(context, entityReorderMatch[1]);
        return;
      }

      const entityMatch = /^\/v1\/entities\/([^/]+)$/.exec(pathname);
      if (entityMatch && req.method === "PATCH") {
        await resumeEditorController.updateEntity(context, entityMatch[1]);
        return;
      }
      if (entityMatch && req.method === "DELETE") {
        await resumeEditorController.deleteEntity(context, entityMatch[1]);
        return;
      }

      const entityBulletsMatch = /^\/v1\/entities\/([^/]+)\/bullets$/.exec(pathname);
      if (entityBulletsMatch && req.method === "POST") {
        await resumeEditorController.createBullet(context, entityBulletsMatch[1]);
        return;
      }

      const bulletReorderMatch = /^\/v1\/entities\/([^/]+)\/bullets\/reorder$/.exec(pathname);
      if (bulletReorderMatch && req.method === "POST") {
        await resumeEditorController.reorderBullets(context, bulletReorderMatch[1]);
        return;
      }

      const bulletMatch = /^\/v1\/bullets\/([^/]+)$/.exec(pathname);
      if (bulletMatch && req.method === "PATCH") {
        await resumeEditorController.updateBullet(context, bulletMatch[1]);
        return;
      }
      if (bulletMatch && req.method === "DELETE") {
        await resumeEditorController.deleteBullet(context, bulletMatch[1]);
        return;
      }

      const bulletVisibilityMatch = /^\/v1\/bullets\/([^/]+)\/visibility$/.exec(pathname);
      if (bulletVisibilityMatch && req.method === "POST") {
        await resumeEditorController.bulletVisibility(context, bulletVisibilityMatch[1]);
        return;
      }

      sendError(res, 404, apiErrorCodes.NOT_FOUND, "Route not found", requestId);
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      const code = error.code ?? apiErrorCodes.INTERNAL_ERROR;
      const message = statusCode >= 500 ? "Unexpected server error" : error.message;
      logger.error("request_failed", {
        requestId,
        service: config.serviceName ?? "tailorstack-api",
        route: pathname,
        userId: currentUserId,
        code,
        statusCode,
        error: error.message
      });
      sendError(res, statusCode, code, message, requestId, error.details);
    } finally {
      logger.info("request_completed", {
        requestId,
        timestamp: new Date().toISOString(),
        service: config.serviceName ?? "tailorstack-api",
        method: req.method,
        route: pathname,
        statusCode: res.statusCode,
        status: res.statusCode < 400 ? "success" : "error",
        userId: currentUserId,
        durationMs: Date.now() - startedAt
      });
    }
  };
}

class InMemoryRateLimiter {
  constructor({ windowMs, maxRequests }) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clients = new Map();
  }

  check(key) {
    const now = Date.now();
    const current = this.clients.get(key);
    if (!current || current.resetAt <= now) {
      this.clients.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }
    current.count += 1;
    return { allowed: current.count <= this.maxRequests };
  }
}

function setSecurityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("cache-control", "no-store");
}

function enforceRequestLimits(req, config) {
  const length = Number.parseInt(req.headers["content-length"] ?? "0", 10);
  if (length > (config.maxRequestBytes ?? 1024 * 1024) && !req.url?.startsWith("/v1/resumes/uploads")) {
    const error = new Error("Request body exceeds size limit");
    error.code = apiErrorCodes.VALIDATION_ERROR;
    error.statusCode = 413;
    throw error;
  }
}

function enforceContentType(req, pathname) {
  if (!["POST", "PATCH", "DELETE"].includes(req.method)) return;
  if (pathname === "/v1/resumes/uploads") {
    if (!/^multipart\/form-data/i.test(req.headers["content-type"] ?? "")) throwContentType();
    return;
  }
  if (!/^application\/json/i.test(req.headers["content-type"] ?? "")) throwContentType();
}

function throwContentType() {
  const error = new Error("Unsupported content type");
  error.code = apiErrorCodes.VALIDATION_ERROR;
  error.statusCode = 415;
  throw error;
}

function clientKey(req) {
  return req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "local";
}
