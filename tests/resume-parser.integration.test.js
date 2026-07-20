import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import zlib from "node:zlib";
import test from "node:test";
import { callApi, callMultipartApi, createTestApi, getSetCookie } from "./helpers/api-test-helpers.js";

const pdf = createCompressedTextPdf([
  "Experience",
  "- Built APIs with Node.js",
  "Projects",
  "- Created a resume parser"
]);

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
    assert.equal(preview.body.data.sections[0].sectionType, "experience");
    assert.notEqual(preview.body.data.sections[0].confidence, 0.55);
    assert.equal(preview.body.data.sections[0].entities[0].bullets[0].confidence > 0, true);
    assert.equal(preview.body.data.sections[0].entities[0].bullets[0].text, "Built APIs with Node.js");
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

function createCompressedTextPdf(lines) {
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -16 Td",
      `(${escapePdfString(line)}) Tj`
    ]),
    "ET"
  ].filter(Boolean).join("\n");
  const compressed = zlib.deflateSync(Buffer.from(content, "latin1"));
  return Buffer.from([
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${compressed.length} /Filter /FlateDecode >> stream`,
    compressed.toString("latin1"),
    "endstream endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF"
  ].join("\n"), "latin1");
}

function escapePdfString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
