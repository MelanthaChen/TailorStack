import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = Buffer.from("%PDF-1.4\n(Experience)\n(- Built APIs)\n");

async function createPromotedResume(app, cookie) {
  const upload = await callMultipartApi(app, {
    url: "/v1/resumes/uploads",
    cookie,
    file: { filename: "resume.pdf", contentType: "application/pdf", buffer: pdf }
  });
  await callApi(app, { method: "POST", url: `/v1/parse-jobs/${upload.body.data.parseJob.id}/run`, cookie });
  await callApi(app, { method: "POST", url: `/v1/resumes/${upload.body.data.resume.id}/promote`, cookie });
  return upload.body.data.resume.id;
}

test("resume editing integration updates canonical data and audits every edit", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-editor-integration-"));
  const { app, repositories } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "editor@example.com", password: "password123" }
    });
    const cookie = getSetCookie(signup);
    const resumeId = await createPromotedResume(app, cookie);
    const canonical = await callApi(app, { method: "GET", url: `/v1/resumes/${resumeId}/canonical`, cookie });
    const section = canonical.body.data.sections[0];
    const entity = section.entities[0];
    const bullet = entity.bullets[0];

    await callApi(app, { method: "PATCH", url: `/v1/sections/${section.id}`, cookie, body: { title: "Work" } });
    await callApi(app, { method: "PATCH", url: `/v1/entities/${entity.id}`, cookie, body: { organization: "OpenAI" } });
    await callApi(app, { method: "PATCH", url: `/v1/bullets/${bullet.id}`, cookie, body: { text: "Built production APIs" } });

    const reloaded = await callApi(app, { method: "GET", url: `/v1/resumes/${resumeId}/canonical`, cookie });
    assert.equal(reloaded.body.data.sections[0].title, "Work");
    assert.equal(reloaded.body.data.sections[0].entities[0].organization, "OpenAI");
    assert.equal(reloaded.body.data.sections[0].entities[0].bullets[0].text, "Built production APIs");
    assert.equal(repositories.promotion.auditEvents.size, 4);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test("resume editing integration validates relationships and ordering", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-editor-validation-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });
  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "editor-validation@example.com", password: "password123" }
    });
    const cookie = getSetCookie(signup);
    const resumeId = await createPromotedResume(app, cookie);
    const response = await callApi(app, {
      method: "POST",
      url: `/v1/resumes/${resumeId}/sections/reorder`,
      cookie,
      body: { orderedIds: ["not-real"] }
    });
    assert.equal(response.statusCode, 422);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
