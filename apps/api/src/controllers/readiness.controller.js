import {
  publicOptimizationRecommendation,
  publicReadinessFinding,
  publicReadinessReport
} from "../../../../packages/schemas/src/index.js";
import { readJson } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class ReadinessController {
  constructor({ readinessService }) {
    this.readinessService = readinessService;
  }

  async create(context) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.readinessService.createReadinessReport({
      user,
      matchReportId: body.matchReportId,
      requestId: context.requestId
    });
    sendSuccess(context.res, 201, serializeResult(result), context.requestId);
  }

  async get(context, readinessReportId) {
    const user = requireAuth(context);
    const result = await this.readinessService.getReadinessReport({ user, readinessReportId });
    sendSuccess(context.res, 200, serializeResult(result), context.requestId);
  }
}

function serializeResult(result) {
  return {
    report: publicReadinessReport(result.report),
    findings: result.findings.map(publicReadinessFinding),
    recommendations: result.recommendations.map(publicOptimizationRecommendation)
  };
}
