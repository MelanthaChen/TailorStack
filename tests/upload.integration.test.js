import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = Buffer.from("%PDF-1.4\nminimal pdf");

test("authenticated user can upload PDF and create records", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-upload-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });

  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: {
        email: "upload@example.com",
        password: "password123"
      }
    });
    const cookie = getSetCookie(signup);

    const upload = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      fields: {
        title: "Master Resume"
      },
      file: {
        filename: "resume.pdf",
        contentType: "application/pdf",
        buffer: pdf
      }
    });

    assert.equal(upload.statusCode, 201);
    assert.equal(upload.body.data.resume.title, "Master Resume");
    assert.equal(upload.body.data.uploadedFile.contentType, "application/pdf");
    assert.equal(upload.body.data.parseJob.jobType, "resume_parse");
    assert.equal(upload.body.data.parseJob.status, "queued");

    const files = [...repositories.uploadedFiles.files.values()];
    const resumes = [...repositories.resumes.resumes.values()];
    const jobs = [...repositories.asyncJobs.jobs.values()];
    assert.equal(files.length, 1);
    assert.equal(resumes.length, 1);
    assert.equal(jobs.length, 1);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("upload endpoint rejects unauthenticated requests", async () => {
  const { app } = createTestApi();
  const upload = await callMultipartApi(app, {
    url: "/v1/resumes/uploads",
    file: {
      filename: "resume.pdf",
      contentType: "application/pdf",
      buffer: pdf
    }
  });

  assert.equal(upload.statusCode, 401);
});
