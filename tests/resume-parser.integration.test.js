import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built APIs with Node.js)\n(Projects)\n(- Created a resume parser)\n");

test("upload to parse integration persists sections, entities, and bullets", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-parser-integration-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });

  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "parser@example.com", password: "password123" }
    });
    const cookie = getSetCookie(signup);
    const upload = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      file: { filename: "resume.pdf", contentType: "application/pdf", buffer: pdf }
    });
    const jobId = upload.body.data.parseJob.id;

    const running = await repositories.asyncJobs.updateJobStatus(jobId, { status: "running" });
    assert.equal(running.status, "running");

    const run = await callApi(app, {
      method: "POST",
      url: `/v1/parse-jobs/${jobId}/run`,
      cookie
    });
    assert.equal(run.statusCode, 200);
    assert.equal(run.body.data.parseJob.status, "succeeded");
    assert.equal(repositories.resumeParser.sections.size, 2);
    assert.equal(repositories.resumeParser.entities.size, 2);
    assert.equal(repositories.resumeParser.bullets.size, 2);

    const preview = await callApi(app, {
      method: "GET",
      url: `/v1/resumes/${upload.body.data.resume.id}/parsed-draft`,
      cookie
    });
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.body.data.sections.length, 2);
    assert.equal(preview.body.data.sections[0].entities[0].bullets[0].confidence > 0, true);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
