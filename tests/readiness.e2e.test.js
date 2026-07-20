import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built 3 backend APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n");

test("end-to-end resume JD match readiness view report", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-readiness-e2e-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const cookie = getSetCookie(await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "readiness-e2e@example.com", password: "password123" }
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
    const created = await callApi(app, {
      method: "POST",
      url: "/v1/readiness-reports",
      cookie,
      body: { matchReportId: match.body.data.report.id }
    });
    const reloaded = await callApi(app, {
      method: "GET",
      url: `/v1/readiness-reports/${created.body.data.report.id}`,
      cookie
    });

    assert.equal(reloaded.statusCode, 200);
    assert.equal(reloaded.body.data.report.id, created.body.data.report.id);
    assert.ok(reloaded.body.data.findings.every((item) => item.reason));
    assert.ok(reloaded.body.data.recommendations.every((item) => item.evidenceRefs.length > 0));
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("frontend exposes read-only readiness report without rewrite or tracker controls", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");
  assert.match(appJs, /Readiness Report/);
  assert.match(appJs, /Strengths/);
  assert.match(appJs, /Recommendations/);
  assert.doesNotMatch(appJs, /Generate rewrite/i);
  assert.doesNotMatch(appJs, /auto.?apply/i);
});
