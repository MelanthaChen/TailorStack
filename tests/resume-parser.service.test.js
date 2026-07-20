import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { InMemoryAsyncJobRepository } from "../apps/api/src/repositories/async-job.repository.js";
import { InMemoryResumeParserRepository } from "../apps/api/src/repositories/resume-parser.repository.js";
import { InMemoryResumeRepository } from "../apps/api/src/repositories/resume.repository.js";
import { InMemoryUploadedFileRepository } from "../apps/api/src/repositories/uploaded-file.repository.js";
import { AiResumeParserService } from "../apps/api/src/services/ai-resume-parser.service.js";
import { PdfExtractionService } from "../apps/api/src/services/pdf-extraction.service.js";
import { ResumeParserService } from "../apps/api/src/services/resume-parser.service.js";
import { FileSystemObjectStorage } from "../packages/object-storage/src/index.js";

test("ResumeParserService executes parse job and persists draft", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-parser-service-"));
  const uploadedFiles = new InMemoryUploadedFileRepository();
  const resumes = new InMemoryResumeRepository();
  const asyncJobs = new InMemoryAsyncJobRepository();
  const resumeParser = new InMemoryResumeParserRepository();
  const storage = new FileSystemObjectStorage({ rootPath, bucket: "bucket" });

  try {
    await storage.putObject("resume.pdf", Buffer.from("%PDF-1.4\n(Experience)\n(- Built APIs)\n"));
    const uploadedFile = await uploadedFiles.createUploadedFile({
      userId: "user_1",
      fileType: "resume_pdf",
      originalFilename: "resume.pdf",
      contentType: "application/pdf",
      byteSize: 10,
      objectStorageKey: "resume.pdf",
      checksumSha256: "abc"
    });
    const resume = await resumes.createResume({
      userId: "user_1",
      title: "Master Resume",
      sourceFileId: uploadedFile.id
    });
    const job = await asyncJobs.createJob({
      userId: "user_1",
      jobType: "resume_parse",
      payloadRef: {
        resumeId: resume.id,
        uploadedFileId: uploadedFile.id
      }
    });
    const service = new ResumeParserService({
      asyncJobRepository: asyncJobs,
      resumeRepository: resumes,
      uploadedFileRepository: uploadedFiles,
      resumeParserRepository: resumeParser,
      objectStorage: storage,
      pdfExtractionService: new PdfExtractionService(),
      aiResumeParserService: new AiResumeParserService(),
      logger: { info() {}, error() {} }
    });

    const result = await service.executeParseJob(job.id, { requestId: "req_1" });
    const completed = await asyncJobs.findJobById(job.id);
    const updatedResume = await resumes.findResumeForUser(resume.id, "user_1");

    assert.equal(completed.status, "succeeded");
    assert.equal(updatedResume.status, "review_required");
    assert.equal(result.sections.length, 1);
    assert.equal(result.sections[0].entities[0].bullets[0].text, "Built APIs");
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("ResumeParserService marks job failed when parser output is invalid", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-parser-fail-"));
  const uploadedFiles = new InMemoryUploadedFileRepository();
  const resumes = new InMemoryResumeRepository();
  const asyncJobs = new InMemoryAsyncJobRepository();
  const resumeParser = new InMemoryResumeParserRepository();
  const storage = new FileSystemObjectStorage({ rootPath, bucket: "bucket" });

  try {
    await storage.putObject("resume.pdf", Buffer.from("%PDF-1.4\n(Experience)\n"));
    const uploadedFile = await uploadedFiles.createUploadedFile({
      userId: "user_1",
      fileType: "resume_pdf",
      originalFilename: "resume.pdf",
      contentType: "application/pdf",
      byteSize: 10,
      objectStorageKey: "resume.pdf",
      checksumSha256: "abc"
    });
    const resume = await resumes.createResume({
      userId: "user_1",
      title: "Master Resume",
      sourceFileId: uploadedFile.id
    });
    const job = await asyncJobs.createJob({
      userId: "user_1",
      jobType: "resume_parse",
      payloadRef: { resumeId: resume.id, uploadedFileId: uploadedFile.id }
    });
    const service = new ResumeParserService({
      asyncJobRepository: asyncJobs,
      resumeRepository: resumes,
      uploadedFileRepository: uploadedFiles,
      resumeParserRepository: resumeParser,
      objectStorage: storage,
      pdfExtractionService: new PdfExtractionService(),
      aiResumeParserService: { async parse() { return { sections: [{ confidence: 9 }] }; } },
      logger: { info() {}, error() {} }
    });

    await assert.rejects(() => service.executeParseJob(job.id), /schema validation/);
    assert.equal((await asyncJobs.findJobById(job.id)).status, "failed");
    await service.retryParseJob(job.id, { user: { id: "user_1" } });
    assert.equal((await asyncJobs.findJobById(job.id)).status, "queued");
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
