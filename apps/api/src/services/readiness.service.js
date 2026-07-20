import { createReadinessExplanationPipeline } from "../../../../packages/ai/pipeline/readiness-explanation-pipeline.js";
import { ReadinessFindingGenerator } from "./readiness-finding-generator.js";
import { ReadinessRecommendationGenerator } from "./readiness-recommendation-generator.js";

export class ReadinessService {
  constructor({
    resumeRepository,
    jobDescriptionRepository,
    matchRepository,
    readinessRepository,
    findingGenerator = new ReadinessFindingGenerator(),
    recommendationGenerator = new ReadinessRecommendationGenerator(),
    explanationPipeline = createReadinessExplanationPipeline(),
    logger
  }) {
    this.resumeRepository = resumeRepository;
    this.jobDescriptionRepository = jobDescriptionRepository;
    this.matchRepository = matchRepository;
    this.readinessRepository = readinessRepository;
    this.findingGenerator = findingGenerator;
    this.recommendationGenerator = recommendationGenerator;
    this.explanationPipeline = explanationPipeline;
    this.logger = logger;
  }

  async createReadinessReport({ user, matchReportId, requestId }) {
    this.logger.info("readiness_report_started", { requestId, userId: user.id, matchReportId });
    const matchResult = await this.matchRepository.findReportForUser(matchReportId, user.id);
    if (!matchResult) throwNotFound("Match report not found");
    const resume = await this.resumeRepository.findResumeForUser(matchResult.report.resumeId, user.id);
    if (!resume || resume.status !== "active") throwValidation("A canonical active resume is required for readiness");
    const jobDescription = await this.jobDescriptionRepository.findForUser(matchResult.report.jobDescriptionId, user.id);
    if (!jobDescription) throwNotFound("Job description not found");

    const deterministicFindings = this.findingGenerator.generate({ matchResult, resume, jobDescription });
    const deterministicRecommendations = this.recommendationGenerator.generate({ findings: deterministicFindings });
    const explained = await this.explanationPipeline.run({
      findings: deterministicFindings,
      recommendations: deterministicRecommendations,
      requestId
    });
    const summary = readinessSummary(matchResult, explained.findings, explained.recommendations);
    const result = await this.readinessRepository.createReport({
      userId: user.id,
      resumeId: resume.id,
      jobDescriptionId: jobDescription.id,
      matchReportId,
      readinessScore: summary.readinessScore,
      summary,
      findings: explained.findings,
      recommendations: explained.recommendations
    });
    this.logger.info("readiness_report_succeeded", {
      requestId,
      userId: user.id,
      readinessReportId: result.report.id,
      readinessScore: result.report.readinessScore
    });
    return result;
  }

  async getReadinessReport({ user, readinessReportId }) {
    const result = await this.readinessRepository.findReportForUser(readinessReportId, user.id);
    if (!result) throwNotFound("Readiness report not found");
    return result;
  }
}

function readinessSummary(matchResult, findings, recommendations) {
  const weaknessCount = findings.filter((item) => item.severity === "weakness").length;
  const warningCount = findings.filter((item) => item.severity === "warning").length;
  const strengthCount = findings.filter((item) => item.severity === "strength").length;
  const penalty = weaknessCount * 7 + warningCount * 3;
  return {
    readinessScore: Math.max(0, Math.min(100, Math.round(Number(matchResult.report.overallScore ?? 0) - penalty + strengthCount * 2))),
    strengthCount,
    warningCount,
    weaknessCount,
    recommendationCount: recommendations.length
  };
}

function throwNotFound(message) {
  const error = new Error(message);
  error.code = "not_found";
  error.statusCode = 404;
  throw error;
}

function throwValidation(message) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 422;
  throw error;
}
