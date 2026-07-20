import { publicJob, publicParsedSection, publicResume } from "../../../../packages/schemas/src/index.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class ResumeParserController {
  constructor({ resumeParserService }) {
    this.resumeParserService = resumeParserService;
  }

  async preview(context, resumeId) {
    const user = requireAuth(context);
    const result = await this.resumeParserService.getParsedDraft({ user, resumeId });
    sendSuccess(context.res, 200, {
      resume: publicResume(result.resume),
      parseJob: publicJob(result.parseJob),
      sections: result.sections.map(publicParsedSection)
    }, context.requestId);
  }

  async run(context, jobId) {
    const user = requireAuth(context);
    const result = await this.resumeParserService.executeParseJob(jobId, { requestId: context.requestId, user });
    sendSuccess(context.res, 200, {
      parseJob: publicJob(result.job),
      sections: result.sections.map(publicParsedSection)
    }, context.requestId);
  }

  async retry(context, jobId) {
    const user = requireAuth(context);
    const job = await this.resumeParserService.retryParseJob(jobId, { user });
    sendSuccess(context.res, 200, {
      parseJob: publicJob(job)
    }, context.requestId);
  }
}
