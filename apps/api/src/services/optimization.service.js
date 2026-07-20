import { PatchGenerator } from "./patch-generator.js";
import { PatchValidator } from "./patch-validator.js";

export class OptimizationService {
  constructor({
    resumeRepository,
    resumeParserRepository,
    readinessRepository,
    matchRepository,
    patchRepository,
    patchGenerator = new PatchGenerator(),
    patchValidator = new PatchValidator(),
    logger
  }) {
    this.resumeRepository = resumeRepository;
    this.resumeParserRepository = resumeParserRepository;
    this.readinessRepository = readinessRepository;
    this.matchRepository = matchRepository;
    this.patchRepository = patchRepository;
    this.patchGenerator = patchGenerator;
    this.patchValidator = patchValidator;
    this.logger = logger;
  }

  async createPatchSet({ user, readinessReportId, requestId }) {
    this.logger.info("optimization_patch_set_started", { requestId, userId: user.id, readinessReportId });
    const readinessResult = await this.readinessRepository.findReportForUser(readinessReportId, user.id);
    if (!readinessResult) throwNotFound("Readiness report not found");
    const matchResult = await this.matchRepository.findReportForUser(readinessResult.report.matchReportId, user.id);
    if (!matchResult) throwNotFound("Match report not found");
    const resume = await this.resumeRepository.findResumeForUser(readinessResult.report.resumeId, user.id);
    if (!resume || resume.status !== "active") throwValidation("A canonical active resume is required for optimization");
    const sections = await this.resumeParserRepository.getParsedDraft(user.id, resume.id);
    const canonicalResume = { resume, sections };

    const candidates = await this.patchGenerator.generate({ canonicalResume, readinessResult, matchResult, requestId });
    const patches = candidates.map((candidate) => this.patchValidator.validatePatch(candidate, canonicalResume));
    const result = await this.patchRepository.createPatchSet({
      userId: user.id,
      resumeId: resume.id,
      readinessReportId,
      matchReportId: readinessResult.report.matchReportId,
      patches
    });
    this.logger.info("optimization_patch_set_succeeded", {
      requestId,
      userId: user.id,
      patchSetId: result.patchSet.id,
      patchCount: result.patches.length
    });
    return result;
  }

  async getPatchSet({ user, patchSetId }) {
    const result = await this.patchRepository.findPatchSetForUser(patchSetId, user.id);
    if (!result) throwNotFound("Optimization patch set not found");
    return result;
  }
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
