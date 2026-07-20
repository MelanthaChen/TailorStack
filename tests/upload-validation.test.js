import assert from "node:assert/strict";
import test from "node:test";
import { sha256, validateResumeUpload } from "../apps/api/src/services/upload-validation.js";

const pdf = Buffer.from("%PDF-1.4\nminimal pdf");

test("validateResumeUpload accepts PDF files", () => {
  const result = validateResumeUpload({
    filename: "resume.pdf",
    contentType: "application/pdf",
    buffer: pdf
  }, { maxUploadBytes: 1024 });

  assert.equal(result.filename, "resume.pdf");
  assert.equal(result.contentType, "application/pdf");
  assert.equal(result.byteSize, pdf.length);
  assert.equal(result.checksumSha256, sha256(pdf));
});

test("validateResumeUpload rejects empty files", () => {
  assert.throws(() => validateResumeUpload({
    filename: "resume.pdf",
    contentType: "application/pdf",
    buffer: Buffer.alloc(0)
  }, { maxUploadBytes: 1024 }), /empty/);
});

test("validateResumeUpload rejects non-PDF MIME and extensions", () => {
  assert.throws(() => validateResumeUpload({
    filename: "resume.txt",
    contentType: "text/plain",
    buffer: Buffer.from("hello")
  }, { maxUploadBytes: 1024 }), /Only PDF/);
});

test("validateResumeUpload rejects files above size limit", () => {
  assert.throws(() => validateResumeUpload({
    filename: "resume.pdf",
    contentType: "application/pdf",
    buffer: pdf
  }, { maxUploadBytes: 3 }), /maximum size/);
});
