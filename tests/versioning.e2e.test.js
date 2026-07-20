import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built backend APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n");

test("end-to-end generate patch accept create version download pdf", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-versioning-e2e-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const { cookie, resumeId, patchSetId } = await createAcceptedPatchSet(app);
    const created = await callApi(app, {
      method: "POST",
      url: "/v1/resume-versions",
      cookie,
      body: { patchSetId }
    });
    const versions = await callApi(app, {
      method: "GET",
      url: `/v1/resumes/${resumeId}/versions`,
      cookie
    });
    const pdfArtifact = created.body.data.renderedResumes.find((item) => item.format === "pdf");
    const download = await callApi(app, {
      method: "GET",
      url: `/v1/rendered-resumes/${pdfArtifact.id}`,
      cookie
    });

    assert.equal(created.statusCode, 201);
    assert.equal(versions.body.data.versions.length, 2);
    assert.equal(download.body.data.renderedResume.contentType, "application/pdf");
    assert.match(download.body.data.content, /^%PDF/);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("frontend exposes version history diff and downloads without application tracking", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");
  assert.match(appJs, /Version History/);
  assert.match(appJs, /Diff Viewer/);
  assert.match(appJs, /Download PDF/);
  assert.doesNotMatch(appJs, /auto.?apply/i);
  assert.doesNotMatch(appJs, /application tracker/i);
});

async function createAcceptedPatchSet(app) {
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
  await callApi(app, {
    method: "POST",
    url: `/v1/optimization-patches/${patchSet.body.data.patches[0].id}/review`,
    cookie,
    body: { state: "accepted" }
  });
  return { cookie, resumeId, patchSetId: patchSet.body.data.patchSet.id };
}
