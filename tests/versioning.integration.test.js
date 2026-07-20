import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built backend APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n");

test("accepted patch set creates immutable version snapshot diff and renders", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-versioning-integration-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const { cookie, resumeId, patchSetId } = await createAcceptedPatchSet(app);
    const canonicalBefore = await callApi(app, { method: "GET", url: `/v1/resumes/${resumeId}/canonical`, cookie });
    const version = await callApi(app, {
      method: "POST",
      url: "/v1/resume-versions",
      cookie,
      body: { patchSetId }
    });
    const canonicalAfter = await callApi(app, { method: "GET", url: `/v1/resumes/${resumeId}/canonical`, cookie });

    assert.equal(version.statusCode, 201);
    assert.equal(version.body.data.version.metadata.versionNumber, 2);
    assert.equal(version.body.data.diff.operationCount > 0, true);
    assert.ok(version.body.data.snapshot.snapshotHash);
    assert.equal(version.body.data.renderedResumes.length, 3);
    assert.deepEqual(canonicalAfter.body.data.sections, canonicalBefore.body.data.sections);
    assert.equal(repositories.versioning.snapshots.size, 1);
    assert.equal(repositories.versioning.renderedResumes.size, 3);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("version creation rejects patch sets without accepted patches", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-versioning-noaccepted-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const { cookie, patchSetId } = await createAcceptedPatchSet(app, { accept: false });
    const response = await callApi(app, {
      method: "POST",
      url: "/v1/resume-versions",
      cookie,
      body: { patchSetId }
    });
    assert.equal(response.statusCode, 422);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

export async function createAcceptedPatchSet(app, { accept = true } = {}) {
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
  const patchSet = await callApi(app, {
    method: "POST",
    url: "/v1/optimization-patch-sets",
    cookie,
    body: { readinessReportId: readiness.body.data.report.id }
  });
  if (accept) {
    await callApi(app, {
      method: "POST",
      url: `/v1/optimization-patches/${patchSet.body.data.patches[0].id}/review`,
      cookie,
      body: { state: "accepted" }
    });
  }
  return { cookie, resumeId, patchSetId: patchSet.body.data.patchSet.id };
}
