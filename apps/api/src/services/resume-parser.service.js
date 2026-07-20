import { normalizeResumeTextForParsing } from "../../../../packages/ai/pipeline/resume-parser-pipeline.js";
import { validateParserOutput } from "./parser-output-validator.js";

export class ResumeParserService {
  constructor({
    asyncJobRepository,
    resumeRepository,
    uploadedFileRepository,
    resumeParserRepository,
    objectStorage,
    pdfExtractionService,
    aiResumeParserService,
    logger
  }) {
    this.asyncJobRepository = asyncJobRepository;
    this.resumeRepository = resumeRepository;
    this.uploadedFileRepository = uploadedFileRepository;
    this.resumeParserRepository = resumeParserRepository;
    this.objectStorage = objectStorage;
    this.pdfExtractionService = pdfExtractionService;
    this.aiResumeParserService = aiResumeParserService;
    this.logger = logger;
  }

  async executeParseJob(jobId, { requestId = crypto.randomUUID(), user = null } = {}) {
    const job = await this.asyncJobRepository.findJobById(jobId);
    if (!job || job.jobType !== "resume_parse") {
      const error = new Error("Parse job not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }
    if (user && job.userId !== user.id) {
      const error = new Error("You do not have access to this parse job");
      error.code = "unauthorized";
      error.statusCode = 403;
      throw error;
    }

    await this.asyncJobRepository.updateJobStatus(job.id, { status: "running" });
    this.logger.info("resume_parse_job_started", { requestId, jobId: job.id, userId: job.userId });

    try {
      const resumeId = job.payloadRef.resumeId;
      const uploadedFileId = job.payloadRef.uploadedFileId;
      const resume = await this.resumeRepository.findResumeForUser(resumeId, job.userId);
      const uploadedFile = await this.uploadedFileRepository.findById(uploadedFileId);
      if (!resume || !uploadedFile || uploadedFile.userId !== job.userId) {
        const error = new Error("Parse job references missing upload data");
        error.code = "validation_error";
        error.statusCode = 422;
        throw error;
      }

      const fileBuffer = await this.objectStorage.getObject(uploadedFile.objectStorageKey);
      this.logger.info("resume_parse_trace", {
        requestId,
        jobId: job.id,
        stage: "uploaded_file",
        uploadedFileSize: uploadedFile.byteSize,
        mimeType: uploadedFile.contentType,
        preview: previewText(fileBuffer.toString("latin1", 0, 200))
      });
      const extraction = this.pdfExtractionService.extract(fileBuffer);
      this.logger.info("resume_parse_trace", {
        requestId,
        jobId: job.id,
        stage: "pdf_extraction",
        preview: previewText(extraction.text)
      });
      const normalizedText = normalizeResumeTextForParsing(extraction.text);
      this.logger.info("resume_parse_trace", {
        requestId,
        jobId: job.id,
        stage: "parser_normalization",
        preview: previewText(normalizedText)
      });
      const parserOutput = validateParserOutput(await this.aiResumeParserService.parse({
        extraction: { ...extraction, text: normalizedText },
        resume,
        uploadedFile
      }));
      this.logger.info("resume_parse_trace", {
        requestId,
        jobId: job.id,
        stage: "database_write",
        preview: previewText(databaseWritePreview(parserOutput))
      });
      const parsedSections = await this.resumeParserRepository.replaceParsedDraft({
        userId: job.userId,
        resumeId,
        sections: parserOutput.sections
      });
      await this.resumeRepository.updateResumeStatus(resumeId, job.userId, "review_required");
      const completed = await this.asyncJobRepository.completeJob(job.id, {
        resultRef: {
          resumeId,
          sectionCount: parsedSections.length
        }
      });
      this.logger.info("resume_parse_job_succeeded", {
        requestId,
        jobId: job.id,
        userId: job.userId,
        resumeId,
        sectionCount: parsedSections.length
      });
      return { job: completed, sections: parsedSections };
    } catch (error) {
      await this.asyncJobRepository.failJob(job.id, {
        errorCode: error.code ?? "parse_failed",
        errorMessage: error.message
      });
      this.logger.error("resume_parse_job_failed", {
        requestId,
        jobId: job.id,
        userId: job.userId,
        error: error.message,
        sqlText: error.sqlText,
        parameterCount: error.parameterCount,
        parameterTypes: error.parameterTypes
      });
      throw error;
    }
  }

  async retryParseJob(jobId, { user = null } = {}) {
    const job = await this.asyncJobRepository.findJobById(jobId);
    if (!job) {
      const error = new Error("Parse job not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }
    if (user && job.userId !== user.id) {
      const error = new Error("You do not have access to this parse job");
      error.code = "unauthorized";
      error.statusCode = 403;
      throw error;
    }
    return this.asyncJobRepository.retryJob(jobId);
  }

  async getParsedDraft({ user, resumeId }) {
    const resume = await this.resumeRepository.findResumeForUser(resumeId, user.id);
    if (!resume) {
      const error = new Error("Resume not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }
    const parseJob = await this.asyncJobRepository.findJobForResume(resumeId, user.id);
    const sections = await this.resumeParserRepository.getParsedDraft(user.id, resumeId);
    return { resume, parseJob, sections };
  }
}

function previewText(value) {
  return String(value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
}

function databaseWritePreview(parserOutput) {
  return (parserOutput.sections ?? [])
    .flatMap((section) => [
      section.title,
      ...(section.entities ?? []).flatMap((entity) => [
        entity.title,
        entity.organization,
        ...(entity.bullets ?? []).map((bullet) => bullet.text)
      ])
    ])
    .filter(Boolean)
    .join("\n");
}
