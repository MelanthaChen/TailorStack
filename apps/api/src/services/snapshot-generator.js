import { createHash } from "node:crypto";

export class SnapshotGenerator {
  generate({ resume, version, sections }) {
    const snapshot = {
      schemaVersion: 1,
      resume: {
        id: resume.id,
        title: resume.title,
        resumeType: resume.resumeType
      },
      sections
    };
    const canonicalJson = stableJson(snapshot);
    return {
      snapshot,
      snapshotHash: createHash("sha256").update(canonicalJson).digest("hex")
    };
  }
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
