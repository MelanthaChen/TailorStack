import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built backend APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n");

test("end-to-end resume version creates application workspace timeline and notes", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-application-e2e-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const fixture = await createVersionFixture(app);
    const versionBefore = await callApi(app, {
      method: "GET",
      url: `/v1/resume-versions/${fixture.versionId}`,
      cookie: fixture.cookie
    });
    const created = await callApi(app, {
      method: "POST",
      url: "/v1/applications",
      cookie: fixture.cookie,
      body: {
        company: "Google",
        position: "Software Engineer",
        resumeVersionId: fixture.versionId,
        renderedResumeId: fixture.renderedResumeId
      }
    });
    const applicationId = created.body.data.application.id;
    await callApi(app, {
      method: "POST",
      url: `/v1/applications/${applicationId}/status`,
      cookie: fixture.cookie,
      body: { status: "interview" }
    });
    await callApi(app, {
      method: "POST",
      url: `/v1/applications/${applicationId}/notes`,
      cookie: fixture.cookie,
      body: { body: "Recruiter screen scheduled." }
    });
    const detail = await callApi(app, {
      method: "GET",
      url: `/v1/applications/${applicationId}`,
      cookie: fixture.cookie
    });
    const versionAfter = await callApi(app, {
      method: "GET",
      url: `/v1/resume-versions/${fixture.versionId}`,
      cookie: fixture.cookie
    });

    assert.equal(created.statusCode, 201);
    assert.equal(detail.body.data.application.status, "interview");
    assert.equal(detail.body.data.notes[0].body, "Recruiter screen scheduled.");
    assert.equal(detail.body.data.events.some((event) => event.eventType === "interview_scheduled"), true);
    assert.deepEqual(versionAfter.body.data.version, versionBefore.body.data.version);
    assert.deepEqual(versionAfter.body.data.snapshot, versionBefore.body.data.snapshot);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("frontend exposes application list detail timeline notes status and artifact links", async () => {
  const appJs = await readFile(new URL("../apps/web/public/app.js", import.meta.url), "utf8");
  assert.match(appJs, /Application Workspace/);
  assert.match(appJs, /Timeline View/);
  assert.match(appJs, /Notes/);
  assert.match(appJs, /Status Update/);
  assert.match(appJs, /Artifact Links/);
  assert.doesNotMatch(appJs, /auto.?apply/i);
});

async function createVersionFixture(app) {
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
  const version = await callApi(app, {
    method: "POST",
    url: "/v1/resume-versions",
    cookie,
    body: { patchSetId: patchSet.body.data.patchSet.id }
  });
  return {
    cookie,
    versionId: version.body.data.version.id,
    renderedResumeId: version.body.data.renderedResumes.find((artifact) => artifact.format === "pdf").id
  };
}
