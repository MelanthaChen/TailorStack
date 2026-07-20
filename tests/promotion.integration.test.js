import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built APIs)\n");

test("draft promotion integration creates canonical resume, version, diff, and audit event", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-promotion-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });

  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "promote@example.com", password: "password123" }
    });
    const cookie = getSetCookie(signup);
    const upload = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      file: { filename: "resume.pdf", contentType: "application/pdf", buffer: pdf }
    });
    const jobId = upload.body.data.parseJob.id;
    await callApi(app, {
      method: "POST",
      url: `/v1/parse-jobs/${jobId}/run`,
      cookie
    });

    const review = await callApi(app, {
      method: "GET",
      url: `/v1/resumes/${upload.body.data.resume.id}/draft-review`,
      cookie
    });
    assert.equal(review.body.data.validation.valid, true);

    const promoted = await callApi(app, {
      method: "POST",
      url: `/v1/resumes/${upload.body.data.resume.id}/promote`,
      cookie
    });

    assert.equal(promoted.statusCode, 201);
    assert.equal(promoted.body.data.resume.status, "active");
    assert.equal(promoted.body.data.version.versionType, "master");
    assert.equal(promoted.body.data.diff.operationCount, 0);
    assert.equal(repositories.promotion.versions.size, 1);
    assert.equal(repositories.promotion.diffs.size, 1);
    assert.equal(repositories.promotion.auditEvents.size, 1);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
