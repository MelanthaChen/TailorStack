import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { callApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

test("end-to-end paste JD preview reload persists data", async () => {
  const { app } = createTestApi();
  const signup = await callApi(app, {
    method: "POST",
    url: "/v1/auth/signup",
    body: { email: "job-e2e@example.com", password: "password123" }
  });
  const cookie = getSetCookie(signup);
  const created = await callApi(app, {
    method: "POST",
    url: "/v1/job-descriptions",
    cookie,
    body: { rawText: sampleJobDescription }
  });
  const jobDescriptionId = created.body.data.jobDescription.id;

  const reloaded = await callApi(app, {
    method: "GET",
    url: `/v1/job-descriptions/${jobDescriptionId}`,
    cookie
  });

  assert.equal(reloaded.statusCode, 200);
  assert.equal(reloaded.body.data.jobDescription.position, "Software Engineer Intern");
  assert.ok(reloaded.body.data.requirements.length > 0);
  assert.ok(reloaded.body.data.keywords.length > 0);
});

test("frontend exposes read-only JD preview without downstream scoring", async () => {
  const appJs = await readFile("apps/web/public/app.js", "utf8");
  assert.match(appJs, /Paste Job Description/);
  assert.match(appJs, /Structured Preview/);
  assert.match(appJs, /Upload JD Text/);
  assert.doesNotMatch(appJs, /ATS score/i);
  assert.doesNotMatch(appJs, /match score/i);
});
