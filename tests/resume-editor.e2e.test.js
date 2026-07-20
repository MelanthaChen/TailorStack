import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built APIs)\n");

test("end-to-end upload parse promote edit reload persists canonical edits", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-editor-e2e-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "editor-e2e@example.com", password: "password123" }
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
    const canonical = await callApi(app, { method: "GET", url: `/v1/resumes/${resumeId}/canonical`, cookie });
    const bulletId = canonical.body.data.sections[0].entities[0].bullets[0].id;
    await callApi(app, {
      method: "PATCH",
      url: `/v1/bullets/${bulletId}`,
      cookie,
      body: { text: "Built durable backend APIs" }
    });
    const reloaded = await callApi(app, { method: "GET", url: `/v1/resumes/${resumeId}/canonical`, cookie });
    assert.equal(reloaded.body.data.sections[0].entities[0].bullets[0].text, "Built durable backend APIs");
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("frontend exposes editor controls without future intelligence features", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");
  assert.match(appJs, /Resume editor/);
  assert.match(appJs, /Add section/);
  assert.match(appJs, /draggable/);
  assert.doesNotMatch(appJs, /rewrite/i);
  assert.doesNotMatch(appJs, /ATS/i);
});
