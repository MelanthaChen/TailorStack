import { loadConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import { createObjectStorage } from "../../../packages/object-storage/src/index.js";
import { createAsyncJobRepository } from "../../../apps/api/src/repositories/async-job.repository.js";
import { createResumeRepository } from "../../../apps/api/src/repositories/resume.repository.js";
import { createResumeParserRepository } from "../../../apps/api/src/repositories/resume-parser.repository.js";
import { createUploadedFileRepository } from "../../../apps/api/src/repositories/uploaded-file.repository.js";
import { AiResumeParserService } from "../../../apps/api/src/services/ai-resume-parser.service.js";
import { PdfExtractionService } from "../../../apps/api/src/services/pdf-extraction.service.js";
import { ResumeParserService } from "../../../apps/api/src/services/resume-parser.service.js";

export function createResumeParserWorker(options = {}) {
  const config = options.config ?? loadConfig();
  const logger = options.logger ?? createLogger({ level: config.logLevel });
  const service = options.resumeParserService ?? new ResumeParserService({
    asyncJobRepository: options.asyncJobRepository ?? createAsyncJobRepository(config),
    resumeRepository: options.resumeRepository ?? createResumeRepository(config),
    uploadedFileRepository: options.uploadedFileRepository ?? createUploadedFileRepository(config),
    resumeParserRepository: options.resumeParserRepository ?? createResumeParserRepository(config),
    objectStorage: options.objectStorage ?? createObjectStorage(config),
    pdfExtractionService: options.pdfExtractionService ?? new PdfExtractionService(),
    aiResumeParserService: options.aiResumeParserService ?? new AiResumeParserService(),
    logger
  });

  return {
    async execute(jobId, metadata = {}) {
      return service.executeParseJob(jobId, metadata);
    }
  };
}

export function describeWorker() {
  return {
    name: "resume-parser",
    status: "implemented-sprint-3",
    jobType: "resume_parse"
  };
}
