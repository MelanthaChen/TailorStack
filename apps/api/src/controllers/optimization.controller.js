import {
  publicOptimizationPatch,
  publicOptimizationPatchSet,
  publicPatchReviewState
} from "../../../../packages/schemas/src/index.js";
import { readJson } from "../http/request.js";
import { sendSuccess } from "../http/response.js";
import { requireAuth } from "../middleware/auth.js";

export class OptimizationController {
  constructor({ optimizationService, reviewStateService }) {
    this.optimizationService = optimizationService;
    this.reviewStateService = reviewStateService;
  }

  async create(context) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.optimizationService.createPatchSet({
      user,
      readinessReportId: body.readinessReportId,
      requestId: context.requestId
    });
    sendSuccess(context.res, 201, serializeResult(result), context.requestId);
  }

  async get(context, patchSetId) {
    const user = requireAuth(context);
    const result = await this.optimizationService.getPatchSet({ user, patchSetId });
    sendSuccess(context.res, 200, serializeResult(result), context.requestId);
  }

  async reviewPatch(context, patchId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.reviewStateService.setPatchReviewState({
      user,
      patchId,
      state: body.state,
      requestId: context.requestId
    });
    sendSuccess(context.res, 200, serializeResult(result), context.requestId);
  }

  async reviewPatchSet(context, patchSetId) {
    const user = requireAuth(context);
    const body = await readJson(context.req);
    const result = await this.reviewStateService.setPatchSetReviewState({
      user,
      patchSetId,
      state: body.state,
      requestId: context.requestId
    });
    sendSuccess(context.res, 200, serializeResult(result), context.requestId);
  }
}

function serializeResult(result) {
  return {
    patchSet: publicOptimizationPatchSet(result.patchSet),
    patches: result.patches.map(publicOptimizationPatch),
    reviewStates: result.reviewStates.map(publicPatchReviewState)
  };
}
