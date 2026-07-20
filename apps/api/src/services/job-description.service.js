import { createJobEnhancementPipeline } from "../../../../packages/ai/pipeline/job-enhancement-pipeline.js";
import { DeterministicJobParser } from "./deterministic-job-parser.js";
import { JobRequirementValidator } from "./job-requirement-validator.js";

export class JobDescriptionService {
  constructor({
    jobDescriptionRepository,
    jobRequirementRepository,
    jobKeywordRepository,
    parser = new DeterministicJobParser(),
    aiPipeline = createJobEnhancementPipeline(),
    validator = new JobRequirementValidator(),
    logger
  }) {
    this.jobDescriptionRepository = jobDescriptionRepository;
    this.jobRequirementRepository = jobRequirementRepository;
    this.jobKeywordRepository = jobKeywordRepository;
    this.parser = parser;
    this.aiPipeline = aiPipeline;
    this.validator = validator;
    this.logger = logger;
  }

  async parseAndPersist({ user, rawText, sourceUrl = null, requestId }) {
    this.logger.info("job_description_parse_started", { requestId, userId: user.id });
    const deterministicModel = this.parser.parse(rawText);
    const normalizedModel = this.validator.validate(await this.aiPipeline.run({ deterministicModel, requestId }));

    const existing = await this.jobDescriptionRepository.findByHashForUser(normalizedModel.rawTextHash, user.id);
    if (existing) {
      const requirements = await this.jobRequirementRepository.listForJob(existing.id, user.id);
      const keywords = await this.jobKeywordRepository.listForJob(existing.id, user.id);
      return { jobDescription: existing, requirements, keywords, duplicate: true };
    }

    const jobDescription = await this.jobDescriptionRepository.create({
      userId: user.id,
      sourceUrl,
      model: normalizedModel
    });
    const requirements = await this.jobRequirementRepository.createMany({
      userId: user.id,
      jobDescriptionId: jobDescription.id,
      requirements: normalizedModel.requirements
    });
    const keywords = await this.jobKeywordRepository.createMany({
      userId: user.id,
      jobDescriptionId: jobDescription.id,
      keywords: normalizedModel.keywords
    });
    this.logger.info("job_description_parse_succeeded", {
      requestId,
      userId: user.id,
      jobDescriptionId: jobDescription.id,
      requirementCount: requirements.length,
      keywordCount: keywords.length
    });
    return { jobDescription, requirements, keywords, duplicate: false };
  }

  async listJobs({ user }) {
    return this.jobDescriptionRepository.listForUser(user.id);
  }

  async getJob({ user, jobDescriptionId }) {
    const jobDescription = await this.jobDescriptionRepository.findForUser(jobDescriptionId, user.id);
    if (!jobDescription) {
      const error = new Error("Job description not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }
    const requirements = await this.jobRequirementRepository.listForJob(jobDescriptionId, user.id);
    const keywords = await this.jobKeywordRepository.listForJob(jobDescriptionId, user.id);
    return { jobDescription, requirements, keywords };
  }
}
