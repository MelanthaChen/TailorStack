import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = Buffer.from("%PDF-1.4\nminimal pdf");

test("upload PDF, refresh list, prevent duplicate, reject invalid file", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-upload-e2e-"));
  const { app } = createTestApi({ objectStorageLocalPath: rootPath });

  try {
    const signup = await callApi(app, {
      method: "POST",
      url: "/v1/auth/signup",
      body: {
        email: "e2e-upload@example.com",
        password: "password123"
      }
    });
    const cookie = getSetCookie(signup);

    const firstUpload = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      file: {
        filename: "resume.pdf",
        contentType: "application/pdf",
        buffer: pdf
      }
    });
    assert.equal(firstUpload.statusCode, 201);

    const listAfterRefresh = await callApi(app, {
      method: "GET",
      url: "/v1/resumes",
      cookie
    });
    assert.equal(listAfterRefresh.statusCode, 200);
    assert.equal(listAfterRefresh.body.data.resumes.length, 1);

    const status = await callApi(app, {
      method: "GET",
      url: `/v1/resumes/${firstUpload.body.data.resume.id}/upload-status`,
      cookie
    });
    assert.equal(status.statusCode, 200);
    assert.equal(status.body.data.parseJob.status, "queued");

    const duplicate = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      file: {
        filename: "resume.pdf",
        contentType: "application/pdf",
        buffer: pdf
      }
    });
    assert.equal(duplicate.statusCode, 409);

    const invalid = await callMultipartApi(app, {
      url: "/v1/resumes/uploads",
      cookie,
      file: {
        filename: "resume.txt",
        contentType: "text/plain",
        buffer: Buffer.from("hello")
      }
    });
    assert.equal(invalid.statusCode, 400);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
