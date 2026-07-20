import { buildResumeMatchProfile } from "./matching-normalizer.js";
import { EvidenceGenerator } from "./evidence-generator.js";
import { GapAnalyzer } from "./gap-analyzer.js";
import { WeightedScorer } from "./weighted-scorer.js";

export class MatchingService {
  constructor({
    resumeRepository,
    resumeParserRepository,
    jobDescriptionRepository,
    jobRequirementRepository,
    jobKeywordRepository,
    matchRepository,
    evidenceGenerator = new EvidenceGenerator(),
    gapAnalyzer = new GapAnalyzer(),
    scorer = new WeightedScorer(),
    logger
  }) {
    this.resumeRepository = resumeRepository;
    this.resumeParserRepository = resumeParserRepository;
    this.jobDescriptionRepository = jobDescriptionRepository;
    this.jobRequirementRepository = jobRequirementRepository;
    this.jobKeywordRepository = jobKeywordRepository;
    this.matchRepository = matchRepository;
    this.evidenceGenerator = evidenceGenerator;
    this.gapAnalyzer = gapAnalyzer;
    this.scorer = scorer;
    this.logger = logger;
  }

  async createMatchReport({ user, resumeId, jobDescriptionId, requestId }) {
    this.logger.info("match_report_started", { requestId, userId: user.id, resumeId, jobDescriptionId });
    const resume = await this.resumeRepository.findResumeForUser(resumeId, user.id);
    if (!resume || resume.status !== "active" || !resume.canonicalVersionId) {
      throwValidation("A canonical active resume is required for matching");
    }
    const jobDescription = await this.jobDescriptionRepository.findForUser(jobDescriptionId, user.id);
    if (!jobDescription) throwNotFound("Job description not found");

    const sections = await this.resumeParserRepository.getParsedDraft(user.id, resumeId);
    const requirements = await this.jobRequirementRepository.listForJob(jobDescriptionId, user.id);
    const keywords = await this.jobKeywordRepository.listForJob(jobDescriptionId, user.id);
    const profile = buildResumeMatchProfile(sections);
    const { evidence, skillMatches } = this.evidenceGenerator.generate({ profile, requirements, keywords });
    const gaps = this.gapAnalyzer.analyze({ profile, requirements, keywords, evidence, jobDescription });
    const scoring = this.scorer.score({ requirements, evidence, gaps });

    const result = await this.matchRepository.createReport({
      userId: user.id,
      resumeId,
      jobDescriptionId,
      overallScore: scoring.overallScore,
      categoryScores: scoring.categoryScores,
      summary: scoring.summary,
      evidence,
      skillMatches,
      gaps
    });
    this.logger.info("match_report_succeeded", {
      requestId,
      userId: user.id,
      matchReportId: result.report.id,
      overallScore: result.report.overallScore
    });
    return result;
  }

  async getMatchReport({ user, matchReportId }) {
    const result = await this.matchRepository.findReportForUser(matchReportId, user.id);
    if (!result) throwNotFound("Match report not found");
    return result;
  }
}

function throwValidation(message) {
  const error = new Error(message);
  error.code = "validation_error";
  error.statusCode = 422;
  throw error;
}

function throwNotFound(message) {
  const error = new Error(message);
  error.code = "not_found";
  error.statusCode = 404;
  throw error;
}
