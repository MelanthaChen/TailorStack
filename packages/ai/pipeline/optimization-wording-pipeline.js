import { LocalAIProvider } from "../providers/local-provider.js";

export class OptimizationWordingPipeline {
  constructor({ provider = new LocalAIProvider() } = {}) {
    this.provider = provider;
  }

  async run({ patchIntent, requestId }) {
    const result = await this.provider.proposeOptimizationWording({ patchIntent, requestId });
    if (!result || typeof result.after !== "string" || result.after.trim() === "") {
      throwInvalid("Optimization wording must include non-empty after text");
    }
    return {
      after: result.after.trim(),
      explanation: result.explanation ?? ""
    };
  }
}

export function createOptimizationWordingPipeline(options = {}) {
  return new OptimizationWordingPipeline(options);
}

function throwInvalid(message) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 422;
  throw error;
}
