import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built backend APIs with JavaScript, TypeScript, Node.js, React, AWS, Docker, and PostgreSQL)\n");

test("application creation links artifacts and persists timeline", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-application-integration-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const fixture = await createVersionFixture(app);
    const application = await callApi(app, {
      method: "POST",
      url: "/v1/applications",
      cookie: fixture.cookie,
      body: {
        company: "Meta",
        position: "Backend Engineer",
        jobDescriptionId: fixture.jobDescriptionId,
        resumeVersionId: fixture.versionId,
        matchReportId: fixture.matchReportId,
        readinessReportId: fixture.readinessReportId,
        optimizationPatchSetId: fixture.patchSetId,
        renderedResumeId: fixture.renderedResumeId,
        status: "preparing"
      }
    });

    assert.equal(application.statusCode, 201);
    assert.equal(application.body.data.application.company, "Meta");
    assert.equal(application.body.data.application.resumeVersionId, fixture.versionId);
    assert.equal(application.body.data.events.some((event) => event.eventType === "application_created"), true);
    assert.equal(application.body.data.events.some((event) => event.eventType === "readiness_generated"), true);
    assert.equal(application.body.data.events.some((event) => event.eventType === "patch_set_generated"), true);
    assert.equal(repositories.applications.applications.size, 1);
    assert.ok(repositories.applications.events.size >= 4);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("application status updates and notes persist history", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-application-status-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const fixture = await createVersionFixture(app);
    const created = await callApi(app, {
      method: "POST",
      url: "/v1/applications",
      cookie: fixture.cookie,
      body: {
        company: "Amazon",
        resumeVersionId: fixture.versionId,
        renderedResumeId: fixture.renderedResumeId
      }
    });
    const applicationId = created.body.data.application.id;
    const status = await callApi(app, {
      method: "POST",
      url: `/v1/applications/${applicationId}/status`,
      cookie: fixture.cookie,
      body: { status: "applied" }
    });
    const note = await callApi(app, {
      method: "POST",
      url: `/v1/applications/${applicationId}/notes`,
      cookie: fixture.cookie,
      body: { body: "Submitted manually." }
    });
    const detail = await callApi(app, {
      method: "GET",
      url: `/v1/applications/${applicationId}`,
      cookie: fixture.cookie
    });

    assert.equal(status.body.data.application.status, "applied");
    assert.equal(note.statusCode, 201);
    assert.equal(detail.body.data.notes.length, 1);
    assert.equal(detail.body.data.events.some((event) => event.eventType === "application_applied"), true);
    assert.equal(detail.body.data.events.some((event) => event.eventType === "manual_note"), true);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
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
    resumeId,
    jobDescriptionId: jd.body.data.jobDescription.id,
    matchReportId: match.body.data.report.id,
    readinessReportId: readiness.body.data.report.id,
    patchSetId: patchSet.body.data.patchSet.id,
    versionId: version.body.data.version.id,
    renderedResumeId: version.body.data.renderedResumes.find((artifact) => artifact.format === "pdf").id
  };
}
