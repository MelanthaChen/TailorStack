export class ReviewStateService {
  constructor({ patchRepository, logger }) {
    this.patchRepository = patchRepository;
    this.logger = logger;
  }

  async setPatchReviewState({ user, patchId, state, requestId }) {
    validateState(state);
    const result = await this.patchRepository.updatePatchReviewState({ userId: user.id, patchId, state });
    if (!result) throwNotFound("Optimization patch not found");
    this.logger.info("optimization_patch_review_state_updated", { requestId, userId: user.id, patchId, state });
    return result;
  }

  async setPatchSetReviewState({ user, patchSetId, state, requestId }) {
    validateState(state);
    const result = await this.patchRepository.updatePatchSetReviewState({ userId: user.id, patchSetId, state });
    if (!result) throwNotFound("Optimization patch set not found");
    this.logger.info("optimization_patch_set_review_state_updated", { requestId, userId: user.id, patchSetId, state });
    return result;
  }
}

function validateState(state) {
  if (!["accepted", "rejected"].includes(state)) {
    const error = new Error("Review state must be accepted or rejected");
    error.code = "validation_error";
    error.statusCode = 422;
    throw error;
  }
}

function throwNotFound(message) {
  const error = new Error(message);
  error.code = "not_found";
  error.statusCode = 404;
  throw error;
}
