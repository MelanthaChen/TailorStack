import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n(Education)\n(- Bachelor degree in Computer Science)\n");

test("canonical resume and JD match persists report evidence and gaps", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-match-integration-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "match-integration@example.com", password: "password123" }
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

    const match = await callApi(app, {
      method: "POST",
      url: "/v1/match-reports",
      cookie,
      body: { resumeId, jobDescriptionId: jd.body.data.jobDescription.id }
    });

    assert.equal(match.statusCode, 201);
    assert.ok(match.body.data.report.overallScore > 0);
    assert.ok(match.body.data.evidence.length > 0);
    assert.ok(match.body.data.skillMatches.some((item) => item.normalizedSkill === "JavaScript"));
    assert.ok(match.body.data.gaps.some((item) => item.reason));
    assert.equal(repositories.matches.reports.size, 1);
    assert.ok(repositories.matches.evidence.size > 0);
    assert.ok(repositories.matches.gaps.size > 0);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
