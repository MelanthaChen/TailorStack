import assert from "node:assert/strict";
import zlib from "node:zlib";
import test from "node:test";
import { PdfExtractionService } from "../apps/api/src/services/pdf-extraction.service.js";

test("PdfExtractionService extracts text and basic layout", () => {
  const service = new PdfExtractionService();
  const result = service.extract(Buffer.from("%PDF-1.4\n(Experience)\n(Built APIs)\n"));

  assert.match(result.text, /Experience/);
  assert.equal(result.pages[0].pageNumber, 1);
  assert.equal(result.pages[0].blocks[0].lines.length >= 2, true);
});

test("PdfExtractionService extracts readable text from compressed PDF content streams", () => {
  const service = new PdfExtractionService();
  const pdf = createCompressedTextPdf([
    "Experience",
    "Software Engineer",
    "Built APIs with Node.js and PostgreSQL",
    "Projects",
    "Created resume parser workflow"
  ]);

  const result = service.extract(pdf);

  assert.match(result.text, /Experience/);
  assert.match(result.text, /Built APIs with Node\.js and PostgreSQL/);
  assert.match(result.text, /Projects/);
  assert.doesNotMatch(result.text, /FlateDecode|endstream|xœ|obj/);
  assert.equal(result.pages[0].blocks[0].lines.length, 5);
});

test("PdfExtractionService emits timed extraction trace and summary logs", () => {
  const logs = [];
  const service = new PdfExtractionService();
  const pdf = createCompressedTextPdf(["Experience", "Built APIs"]);

  const result = service.extract(pdf, {
    requestId: "req_pdf",
    jobId: "job_pdf",
    logger: {
      info(event, fields) {
        logs.push({ event, fields });
      }
    }
  });

  assert.match(result.text, /Experience/);
  assert.ok(logs.some((entry) => entry.event === "pdf_extraction_step_started" && entry.fields.operation === "Finding objects"));
  assert.ok(logs.some((entry) => entry.event === "pdf_extraction_trace" && /Processing object 1\/1/.test(entry.fields.operation)));
  assert.ok(logs.some((entry) => entry.event === "pdf_extraction_trace" && /Inflating stream 1/.test(entry.fields.operation)));

  const finished = logs.find((entry) => entry.event === "pdf_extraction_step_finished" && entry.fields.operation === "Extracting text operators");
  assert.equal(typeof finished.fields.startTime, "string");
  assert.equal(typeof finished.fields.endTime, "string");
  assert.equal(typeof finished.fields.elapsedMs, "number");

  const summary = logs.find((entry) => entry.event === "pdf_extraction_summary");
  assert.equal(summary.fields.objectsProcessed, 1);
  assert.equal(summary.fields.streamsInflated, 1);
  assert.equal(summary.fields.textOperatorsFound, 2);
  assert.equal(summary.fields.charactersExtracted > 0, true);
  assert.equal(typeof summary.fields.elapsedMs, "number");
});

test("PdfExtractionService aborts malformed streams with a meaningful error", () => {
  const service = new PdfExtractionService();
  const malformed = Buffer.from([
    "%PDF-1.4",
    "1 0 obj << /Length 10 /Filter /FlateDecode >> stream",
    "not-valid-deflate"
  ].join("\n"), "latin1");

  assert.throws(() => service.extract(malformed), /has no endstream marker|could not inflate stream/);
});

test("PdfExtractionService skips compressed object streams without running text extraction on them", () => {
  const logs = [];
  const service = new PdfExtractionService();
  const objectStreamContent = [
    "18 0 19 33 20 220",
    "<< /A << /S /URI /URI (mailto:person@example.com) >> /Type /Annot >>",
    "<< /Limits [ (Doc-Start) (section*.4) ] /Names [ (Doc-Start) 23 0 R (page.) 22 0 R ] >>"
  ].join("\n");
  const objectStream = zlib.deflateSync(Buffer.from(objectStreamContent, "latin1"));
  const pdf = Buffer.from([
    "%PDF-1.5",
    `1 0 obj << /Type /ObjStm /Length ${objectStream.length} /Filter /FlateDecode /N 3 /First 20 >> stream`,
    objectStream.toString("latin1"),
    "endstream endobj",
    "%%EOF"
  ].join("\n"), "latin1");

  const result = service.extract(pdf, {
    logger: {
      info(event, fields) {
        logs.push({ event, fields });
      }
    }
  });

  assert.equal(result.metadata.extractionSummary.objectsProcessed, 1);
  assert.equal(result.metadata.extractionSummary.streamsInflated, 0);
  assert.ok(logs.some((entry) => entry.event === "pdf_extraction_trace" && entry.fields.operation === "Skipping non-content stream 1"));
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
