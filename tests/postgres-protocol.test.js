import assert from "node:assert/strict";
import test from "node:test";
import {
  describeParameter,
  encodeTextParameter,
  queryMetadata,
  sqlLiteral
} from "../packages/database/src/index.js";

test("SQL literals strip embedded NUL bytes before simple-query encoding", () => {
  const literal = sqlLiteral("Built APIs\0 with Node.js");

  assert.equal(literal, "'Built APIs with Node.js'");
  assert.equal(literal.includes("\0"), false);
});

test("SQL literal sanitization is recursive for JSON payloads", () => {
  const literal = sqlLiteral({
    source: "pdf\0extractor",
    lines: ["Experience\0", "Built APIs"]
  });

  assert.equal(literal.includes("\0"), false);
  assert.match(literal, /pdfextractor/);
  assert.match(literal, /Experience/);
});

test("extended query parameter encoding reports type metadata without passwords", () => {
  const params = [
    "text",
    Buffer.from([0xde, 0xad, 0xbe, 0xef]),
    new Date("2026-07-20T12:00:00.000Z"),
    ["JavaScript", "TypeScript"]
  ];

  assert.equal(encodeTextParameter(params[1]), "\\xdeadbeef");
  assert.deepEqual(describeParameter(params[1]), { type: "buffer", byteLength: 4 });
  assert.deepEqual(describeParameter(params[2]), { type: "date" });
  assert.deepEqual(describeParameter(params[3]), { type: "array", length: 2 });

  const metadata = queryMetadata("SELECT $1, $2, $3, $4", params);
  assert.equal(metadata.parameterCount, 4);
  assert.deepEqual(metadata.parameterTypes.map((item) => item.type), ["string", "buffer", "date", "array"]);
});
