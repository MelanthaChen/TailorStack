import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built backend APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n");

test("readiness report creates persisted optimization patch set", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-optimization-integration-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const { cookie, resumeId, readinessReportId } = await createReadinessFixture(app);
    const patchSet = await callApi(app, {
      method: "POST",
      url: "/v1/optimization-patch-sets",
      cookie,
      body: { readinessReportId }
    });

    assert.equal(patchSet.statusCode, 201);
    assert.ok(patchSet.body.data.patches.length > 0);
    assert.ok(patchSet.body.data.patches.every((patch) => patch.evidence.length > 0));
    assert.equal(patchSet.body.data.patchSet.resumeId, resumeId);
    assert.equal(repositories.patches.patchSets.size, 1);
    assert.ok(repositories.patches.patches.size > 0);
    assert.ok(repositories.patches.reviewStates.size > 0);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("accepting optimization patches leaves canonical resume unchanged", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-optimization-unchanged-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const { cookie, resumeId, readinessReportId } = await createReadinessFixture(app);
    const before = await callApi(app, { method: "GET", url: `/v1/resumes/${resumeId}/canonical`, cookie });
    const patchSet = await callApi(app, {
      method: "POST",
      url: "/v1/optimization-patch-sets",
      cookie,
      body: { readinessReportId }
    });
    await callApi(app, {
      method: "POST",
      url: `/v1/optimization-patch-sets/${patchSet.body.data.patchSet.id}/review`,
      cookie,
      body: { state: "accepted" }
    });
    const after = await callApi(app, { method: "GET", url: `/v1/resumes/${resumeId}/canonical`, cookie });

    assert.deepEqual(after.body.data.sections, before.body.data.sections);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

async function createReadinessFixture(app) {
  const cookie = getSetCookie(await callApi(app, {
    method: "POST",
    url: "/v1/auth/signup",
    body: { email: `${crypto.randomUUID()}@example.com`, password: "password123" }
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
  return { cookie, resumeId, readinessReportId: readiness.body.data.report.id };
}
