import {
  publicJobDescription,
  publicJobKeyword,
  publicJobRequirement
} from "../../../../packages/schemas/src/index.js";
import { readBody, readJson } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class JobDescriptionController {
  constructor({ jobDescriptionService }) {
    this.jobDescriptionService = jobDescriptionService;
  }

  async create(context) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.jobDescriptionService.parseAndPersist({
      user,
      rawText: body.rawText,
      sourceUrl: body.sourceUrl ?? null,
      requestId: context.requestId
    });
    sendSuccess(context.res, result.duplicate ? 200 : 201, serializeResult(result), context.requestId);
  }

  async uploadText(context) {
    const user = requireAuth(context);
    const body = await readBody(context.req, { maxBytes: 512 * 1024 });
    const result = await this.jobDescriptionService.parseAndPersist({
      user,
      rawText: body.toString("utf8"),
      sourceUrl: null,
      requestId: context.requestId
    });
    sendSuccess(context.res, result.duplicate ? 200 : 201, serializeResult(result), context.requestId);
  }

  async list(context) {
    const user = requireAuth(context);
    const jobDescriptions = await this.jobDescriptionService.listJobs({ user });
    sendSuccess(context.res, 200, {
      jobDescriptions: jobDescriptions.map(publicJobDescription)
    }, context.requestId);
  }

  async get(context, jobDescriptionId) {
    const user = requireAuth(context);
    const result = await this.jobDescriptionService.getJob({ user, jobDescriptionId });
    sendSuccess(context.res, 200, serializeResult(result), context.requestId);
  }
}

function serializeResult(result) {
  return {
    jobDescription: publicJobDescription(result.jobDescription),
    requirements: result.requirements.map(publicJobRequirement),
    keywords: result.keywords.map(publicJobKeyword),
    duplicate: Boolean(result.duplicate)
  };
}
