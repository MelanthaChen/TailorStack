import assert from "node:assert/strict";
import test from "node:test";
import { PdfExtractionService } from "../apps/api/src/services/pdf-extraction.service.js";

test("PdfExtractionService extracts text and basic layout", () => {
  const service = new PdfExtractionService();
  const result = service.extract(Buffer.from("%PDF-1.4\n(Experience)\n(Built APIs)\n"));

  assert.match(result.text, /Experience/);
  assert.equal(result.pages[0].pageNumber, 1);
  assert.equal(result.pages[0].blocks[0].lines.length >= 2, true);
});
