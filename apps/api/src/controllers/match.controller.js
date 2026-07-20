import {
  publicMatchEvidence,
  publicMatchReport,
  publicSkillGap,
  publicSkillMatch
} from "../../../../packages/schemas/src/index.js";
import { readJson } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class MatchController {
  constructor({ matchingService }) {
    this.matchingService = matchingService;
  }

  async create(context) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.matchingService.createMatchReport({
      user,
      resumeId: body.resumeId,
      jobDescriptionId: body.jobDescriptionId,
      requestId: context.requestId
    });
    sendSuccess(context.res, 201, serializeResult(result), context.requestId);
  }

  async get(context, matchReportId) {
    const user = requireAuth(context);
    const result = await this.matchingService.getMatchReport({ user, matchReportId });
    sendSuccess(context.res, 200, serializeResult(result), context.requestId);
  }
}

function serializeResult(result) {
  return {
    report: publicMatchReport(result.report),
    evidence: result.evidence.map(publicMatchEvidence),
    skillMatches: result.skillMatches.map(publicSkillMatch),
    gaps: result.gaps.map(publicSkillGap)
  };
}
