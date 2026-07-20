import { LocalAIProvider } from "../providers/local-provider.js";

export class ReadinessExplanationPipeline {
  constructor({ provider = new LocalAIProvider() } = {}) {
    this.provider = provider;
  }

  async run({ findings, recommendations, requestId }) {
    const explained = await this.provider.explainReadiness({ findings, recommendations, requestId });
    validateNoDecisionChanges({ findings, recommendations }, explained);
    return explained;
  }
}

export function createReadinessExplanationPipeline(options = {}) {
  return new ReadinessExplanationPipeline(options);
}

function validateNoDecisionChanges(original, explained) {
  if ((explained.findings ?? []).length !== original.findings.length) throwInvalid("AI explanation cannot add or remove findings");
  if ((explained.recommendations ?? []).length !== original.recommendations.length) {
    throwInvalid("AI explanation cannot add or remove recommendations");
  }
  for (const [index, finding] of original.findings.entries()) {
    const next = explained.findings[index];
    if (next.category !== finding.category || next.severity !== finding.severity || next.confidence !== finding.confidence) {
      throwInvalid("AI explanation cannot change finding decisions");
    }
  }
  for (const [index, recommendation] of original.recommendations.entries()) {
    const next = explained.recommendations[index];
    if (next.priority !== recommendation.priority || next.confidence !== recommendation.confidence) {
      throwInvalid("AI explanation cannot change recommendation decisions");
    }
  }
}

function throwInvalid(message) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 422;
  throw error;
}
