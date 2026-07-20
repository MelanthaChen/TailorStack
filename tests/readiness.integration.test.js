import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built 3 backend APIs with JavaScript, TypeScript, Node.js, React, Docker, and PostgreSQL)\n");

test("match report produces persisted readiness report findings and recommendations", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-readiness-integration-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const cookie = getSetCookie(await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "readiness-integration@example.com", password: "password123" }
    }));
    const upload = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      file: { filename: "resume.pdf", contentType: "application/pdf", buffer: pdf }
    });
    const resumeId = upload.body.data.resume.id;
    await callApi(app, { method: "POST", url: `/v1/parse-jobs/${upload.body.data.parseJob.id}/run`, cookie });
    await callApi(app, { method: "POST", url: `/v1/resumes/${resumeId}/promote`, cookie });
    const jd = await callApi(app, {
      method: "POST",
      url: "/v1/job-descriptions",
      cookie,
      body: { rawText: sampleJobDescription }
    });
    const match = await callApi(app, {
      method: "POST",
      url: "/v1/match-reports",
      cookie,
      body: { resumeId, jobDescriptionId: jd.body.data.jobDescription.id }
    });

    const readiness = await callApi(app, {
      method: "POST",
      url: "/v1/readiness-reports",
      cookie,
      body: { matchReportId: match.body.data.report.id }
    });

    assert.equal(readiness.statusCode, 201);
    assert.ok(readiness.body.data.report.readinessScore >= 0);
    assert.ok(readiness.body.data.findings.length > 0);
    assert.ok(readiness.body.data.recommendations.every((item) => item.evidenceRefs.length > 0));
    assert.equal(repositories.readiness.reports.size, 1);
    assert.ok(repositories.readiness.findings.size > 0);
    assert.ok(repositories.readiness.recommendations.size > 0);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
