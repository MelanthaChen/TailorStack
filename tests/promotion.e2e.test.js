import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built production services)\n");

test("end-to-end upload parse review approve creates canonical resume", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-promotion-e2e-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });

  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "promote-e2e@example.com", password: "password123" }
    });
    const cookie = getSetCookie(signup);
    const upload = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      file: { filename: "resume.pdf", contentType: "application/pdf", buffer: pdf }
    });
    await callApi(app, {
      method: "POST",
      url: `/v1/parse-jobs/${upload.body.data.parseJob.id}/run`,
      cookie
    });
    const review = await callApi(app, {
      method: "GET",
      url: `/v1/resumes/${upload.body.data.resume.id}/draft-review`,
      cookie
    });
    assert.equal(review.statusCode, 200);
    assert.equal(review.body.data.sections.length, 1);

    const promoted = await callApi(app, {
      method: "POST",
      url: `/v1/resumes/${upload.body.data.resume.id}/promote`,
      cookie
    });
    assert.equal(promoted.statusCode, 201);
    assert.equal(promoted.body.data.resume.canonicalVersionId, promoted.body.data.version.id);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("frontend draft review supports approve reject rerun cancel with no editing", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");
  assert.match(appJs, /Review parsed draft/);
  assert.match(appJs, /Approve/);
  assert.match(appJs, /Reject/);
  assert.match(appJs, /Re-run parser/);
  assert.match(appJs, /Cancel/);
  assert.doesNotMatch(appJs, /contenteditable/i);
});
