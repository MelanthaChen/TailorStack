import assert from "node:assert/strict";
import test from "node:test";
import { callApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";
import { sampleJobDescription } from "./job-fixtures.js";

test("paste JD parses and persists normalized job model", async () => {
  const { app, repositories } = createTestApi();
  const signup = await callApi(app, {
    method: "POST",
    url: "/v1/auth/signup",
    body: { email: "job-integration@example.com", password: "password123" }
  });
  const cookie = getSetCookie(signup);

  const response = await callApi(app, {
    method: "POST",
    url: "/v1/job-descriptions",
    cookie,
    body: { rawText: sampleJobDescription }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.jobDescription.company, "Acme Cloud");
  assert.ok(response.body.data.requirements.some((item) => item.normalizedText === "JavaScript"));
  assert.ok(response.body.data.keywords.some((item) => item.normalizedKeyword === "Amazon Web Services"));
  assert.equal(repositories.jobDescriptions.jobDescriptions.size, 1);
  assert.ok(repositories.jobRequirements.requirements.size > 0);
  assert.ok(repositories.jobKeywords.keywords.size > 0);
});

test("protected JD endpoint rejects unauthenticated users", async () => {
  const { app } = createTestApi();
  const response = await callApi(app, {
    method: "POST",
    url: "/v1/job-descriptions",
    body: { rawText: sampleJobDescription }
  });
  assert.equal(response.statusCode, 401);
});
