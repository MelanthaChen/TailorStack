import assert from "node:assert/strict";
import test from "node:test";
import { validateParserOutput } from "../apps/api/src/services/parser-output-validator.js";

test("validateParserOutput accepts valid structured parser output", () => {
  const output = validateParserOutput({
    sections: [{
      sectionType: "experience",
      title: "Experience",
      confidence: 0.9,
      entities: [{
        entityType: "experience",
        title: null,
        confidence: 0.8,
        bullets: [{
          text: "Built APIs with Node.js",
          confidence: 0.85
        }]
      }]
    }]
  });

  assert.equal(output.sections.length, 1);
});

test("validateParserOutput rejects invalid confidence", () => {
  assert.throws(() => validateParserOutput({
    sections: [{
      sectionType: "experience",
      title: "Experience",
      confidence: 2,
      entities: []
    }]
  }), /schema validation/);
});

test("validateParserOutput rejects missing parent-child arrays", () => {
  assert.throws(() => validateParserOutput({
    sections: [{
      sectionType: "experience",
      title: "Experience",
      confidence: 0.8
    }]
  }), /schema validation/);
});
