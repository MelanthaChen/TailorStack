import assert from "node:assert/strict";
import test from "node:test";
import { validateJobModel } from "../packages/ai/validation/job-model-validator.js";
import { sampleJobDescription } from "./job-fixtures.js";

test("job model validator rejects duplicate requirements and keywords", () => {
  const model = {
    rawText: sampleJobDescription,
    requirements: [
      { type: "required_skill", text: "JavaScript", normalizedText: "JavaScript", category: "programming_language", confidence: 0.9 },
      { type: "required_skill", text: "JS", normalizedText: "JavaScript", category: "programming_language", confidence: 0.9 }
    ],
    keywords: [
      { keyword: "AWS", normalizedKeyword: "Amazon Web Services", source: "test", confidence: 0.8 },
      { keyword: "Amazon Web Services", normalizedKeyword: "Amazon Web Services", source: "test", confidence: 0.8 }
    ]
  };
  assert.throws(() => validateJobModel(model), /duplicate normalized value/);
});
