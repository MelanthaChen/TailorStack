import {
  publicJob,
  publicParsedSection,
  publicPromotionValidation,
  publicResume,
  publicResumeDiff,
  publicResumeVersion
} from "../../../../packages/schemas/src/index.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class DraftReviewController {
  constructor({ draftPromotionService }) {
    this.draftPromotionService = draftPromotionService;
  }

  async review(context, resumeId) {
    const user = requireAuth(context);
    const result = await this.draftPromotionService.getReview({ user, resumeId });
    sendSuccess(context.res, 200, {
      resume: publicResume(result.resume),
      parseJob: publicJob(result.parseJob),
      validation: publicPromotionValidation(result.validation),
      sections: result.sections.map(publicParsedSection)
    }, context.requestId);
  }

  async approve(context, resumeId) {
    const user = requireAuth(context);
    const result = await this.draftPromotionService.promote({
      user,
      resumeId,
      requestId: context.requestId
    });
    sendSuccess(context.res, 201, {
      resume: publicResume(result.resume),
      version: publicResumeVersion(result.version),
      diff: publicResumeDiff(result.diff)
    }, context.requestId);
  }

  async reject(context, resumeId) {
    const user = requireAuth(context);
    const resume = await this.draftPromotionService.reject({
      user,
      resumeId,
      requestId: context.requestId
    });
    sendSuccess(context.res, 200, {
      resume: publicResume(resume)
    }, context.requestId);
  }
}
