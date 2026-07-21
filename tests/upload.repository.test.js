import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAsyncJobRepository } from "../apps/api/src/repositories/async-job.repository.js";
import { InMemoryResumeRepository } from "../apps/api/src/repositories/resume.repository.js";
import { InMemoryUploadedFileRepository } from "../apps/api/src/repositories/uploaded-file.repository.js";

test("uploaded file repository detects duplicate checksum for same user", async () => {
  const repository = new InMemoryUploadedFileRepository();
  await repository.createUploadedFile({
    userId: "user_1",
    fileType: "resume_pdf",
    originalFilename: "resume.pdf",
    contentType: "application/pdf",
    byteSize: 10,
    objectStorageKey: "key",
    checksumSha256: "abc"
  });

  assert.equal((await repository.findByChecksumForUser("user_1", "abc")).checksumSha256, "abc");
  assert.equal(await repository.findByChecksumForUser("user_2", "abc"), null);
});

test("resume repository lists resumes by user", async () => {
  const repository = new InMemoryResumeRepository();
  await repository.createResume({
    userId: "user_1",
    title: "Master Resume",
    sourceFileId: "file_1"
  });

  assert.equal((await repository.listResumesForUser("user_1")).length, 1);
  assert.equal((await repository.listResumesForUser("user_2")).length, 0);
});

test("async job repository creates parse jobs", async () => {
  const repository = new InMemoryAsyncJobRepository();
  const job = await repository.createJob({
    userId: "user_1",
    jobType: "resume_parse",
    payloadRef: {
      resumeId: "resume_1"
    }
  });

  assert.equal(job.status, "queued");
  assert.equal(job.stage, "queued");
  assert.equal(job.progress, 0);
  assert.equal(job.message, "Queued.");
  assert.equal((await repository.findJobForResume("resume_1", "user_1")).id, job.id);
});

test("async job repository tracks parser progress stages", async () => {
  const repository = new InMemoryAsyncJobRepository();
  const job = await repository.createJob({
    userId: "user_1",
    jobType: "resume_parse",
    payloadRef: { resumeId: "resume_1" }
  });

  const updated = await repository.updateJobProgress(job.id, {
    status: "running",
    stage: "extracting_text",
    progress: 35,
    message: "Extracting text from PDF..."
  });

  assert.equal(updated.status, "running");
  assert.equal(updated.stage, "extracting_text");
  assert.equal(updated.progress, 35);
  assert.equal(updated.message, "Extracting text from PDF...");
  assert.ok(updated.updatedAt);
});
