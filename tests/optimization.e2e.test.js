import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built backend APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n");

test("end-to-end generate patch set and review patches", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-optimization-e2e-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const cookie = getSetCookie(await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "optimization-e2e@example.com", password: "password123" }
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
    const patchId = patchSet.body.data.patches[0].id;
    const reviewed = await callApi(app, {
      method: "POST",
      url: `/v1/optimization-patches/${patchId}/review`,
      cookie,
      body: { state: "rejected" }
    });

    assert.equal(reviewed.statusCode, 200);
    assert.equal(reviewed.body.data.reviewStates.find((state) => state.patchId === patchId).state, "rejected");
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("frontend exposes optimization review without version application", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");
  assert.match(appJs, /Optimization Review/);
  assert.match(appJs, /Before/);
  assert.match(appJs, /After/);
  assert.match(appJs, /Accept All/);
  assert.doesNotMatch(appJs, /Apply patch/i);
  assert.doesNotMatch(appJs, /version application/i);
});
