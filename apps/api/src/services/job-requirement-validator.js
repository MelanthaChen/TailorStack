import { validateJobModel } from "../../../../packages/ai/validation/job-model-validator.js";

export class JobRequirementValidator {
  validate(model) {
    return validateJobModel(model);
  }
}
