import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built backend APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n");

test("end-to-end upload promote paste JD run match view report", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-match-e2e-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "match-e2e@example.com", password: "password123" }
    });
    const cookie = getSetCookie(signup);
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
    const created = await callApi(app, {
      method: "POST",
      url: "/v1/match-reports",
      cookie,
      body: { resumeId, jobDescriptionId: jd.body.data.jobDescription.id }
    });
    const reloaded = await callApi(app, {
      method: "GET",
      url: `/v1/match-reports/${created.body.data.report.id}`,
      cookie
    });

    assert.equal(reloaded.statusCode, 200);
    assert.equal(reloaded.body.data.report.id, created.body.data.report.id);
    assert.ok(reloaded.body.data.evidence.every((item) => item.evidenceText));
    assert.ok(reloaded.body.data.gaps.every((item) => item.reason));
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("frontend exposes read-only match result without ATS or rewrite controls", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");
  assert.match(appJs, /Match Result/);
  assert.match(appJs, /Category Breakdown/);
  assert.match(appJs, /Matched Skills/);
  assert.doesNotMatch(appJs, /ATS score/i);
  assert.doesNotMatch(appJs, /rewrite/i);
});
