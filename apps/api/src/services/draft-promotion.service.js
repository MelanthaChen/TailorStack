import { validateDraftForPromotion } from "./promotion-validator.js";

export class DraftPromotionService {
  constructor({
    resumeRepository,
    resumeParserRepository,
    asyncJobRepository,
    promotionRepository,
    canonicalResumeResolver,
    logger
  }) {
    this.resumeRepository = resumeRepository;
    this.resumeParserRepository = resumeParserRepository;
    this.asyncJobRepository = asyncJobRepository;
    this.promotionRepository = promotionRepository;
    this.canonicalResumeResolver = canonicalResumeResolver;
    this.logger = logger;
  }

  async getReview({ user, resumeId }) {
    const resume = await this.requireResume(user, resumeId);
    const parseJob = await this.asyncJobRepository.findJobForResume(resumeId, user.id);
    const sections = await this.resumeParserRepository.getParsedDraft(user.id, resumeId);
    const validation = validateDraftForPromotion({ resume, parseJob, sections });
    return { resume, parseJob, sections, validation };
  }

  async promote({ user, resumeId, requestId }) {
    const review = await this.getReview({ user, resumeId });
    if (!review.validation.valid) {
      const error = new Error("Parsed draft is not valid for promotion");
      error.code = "validation_error";
      error.statusCode = 422;
      error.details = review.validation;
      throw error;
    }
    if (review.resume.canonicalVersionId) {
      const error = new Error("Canonical resume already exists");
      error.code = "conflict";
      error.statusCode = 409;
      throw error;
    }

    const result = await this.promotionRepository.promoteDraft({
      userId: user.id,
      resumeId,
      resumeTitle: review.resume.title,
      requestId
    });

    this.logger.info("resume_promotion_succeeded", {
      requestId,
      userId: user.id,
      resumeId,
      versionId: result.version.id,
      diffId: result.diff.id
    });

    return {
      ...result,
      canonical: await this.canonicalResumeResolver.resolve({ user, resumeId })
    };
  }

  async reject({ user, resumeId, requestId }) {
    const resume = await this.requireResume(user, resumeId);
    const updated = await this.resumeRepository.updateResumeStatus(resume.id, user.id, "archived");
    this.logger.info("resume_draft_rejected", {
      requestId,
      userId: user.id,
      resumeId
    });
    return updated;
  }

  async requireResume(user, resumeId) {
    const resume = await this.resumeRepository.findResumeForUser(resumeId, user.id);
    if (!resume) {
      const error = new Error("Resume not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }
    return resume;
  }
}
