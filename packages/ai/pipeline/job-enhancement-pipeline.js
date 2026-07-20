import { LocalAIProvider } from "../providers/local-provider.js";
import { validateJobModel } from "../validation/job-model-validator.js";

export class JobEnhancementPipeline {
  constructor({ provider = new LocalAIProvider() } = {}) {
    this.provider = provider;
  }

  async run({ deterministicModel, requestId }) {
    const enhanced = await this.provider.enhanceJobModel({ deterministicModel, requestId });
    return validateJobModel(enhanced);
  }
}

export function createJobEnhancementPipeline(options = {}) {
  return new JobEnhancementPipeline(options);
}
