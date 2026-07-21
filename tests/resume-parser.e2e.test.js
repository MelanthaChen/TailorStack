import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built backend services)\n");

test("end-to-end upload PDF then parse structured draft", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-parser-e2e-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });

  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "parser-e2e@example.com", password: "password123" }
    });
    const cookie = getSetCookie(signup);
    const upload = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      file: { filename: "resume.pdf", contentType: "application/pdf", buffer: pdf }
    });

    assert.equal(upload.body.data.parseJob.status, "queued");
    const running = await repositories.asyncJobs.updateJobStatus(upload.body.data.parseJob.id, { status: "running" });
    assert.equal(running.status, "running");

    const run = await callApi(app, {
      method: "POST",
      url: `/v1/parse-jobs/${upload.body.data.parseJob.id}/run`,
      cookie
    });
    assert.equal(run.body.data.parseJob.status, "succeeded");
    assert.equal(run.body.data.parseJob.stage, "completed");
    assert.equal(run.body.data.parseJob.progress, 100);
    assert.equal(run.body.data.parseJob.message, "Parse completed.");

    const preview = await callApi(app, {
      method: "GET",
      url: `/v1/resumes/${upload.body.data.resume.id}/parsed-draft`,
      cookie
    });
    assert.match(preview.body.data.sections[0].entities[0].bullets[0].text, /Built backend/);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("frontend parsed draft preview is read-only", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");
  assert.match(appJs, /Read-only preview/);
  assert.match(appJs, /parseProgressHtml/);
  assert.match(appJs, /progress-bar/);
  assert.match(appJs, /Parsing resume sections/);
  assert.match(appJs, /pollParseProgress/);
  assert.doesNotMatch(appJs, /confirm parsed/i);
  assert.doesNotMatch(appJs, /contenteditable/i);
});
