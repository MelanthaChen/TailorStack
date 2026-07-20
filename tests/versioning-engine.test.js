import assert from "node:assert/strict";
import test from "node:test";
import { ConflictDetector } from "../apps/api/src/services/conflict-detector.js";
import { PatchApplier } from "../apps/api/src/services/patch-applier.js";
import { RendererService } from "../apps/api/src/services/renderer.service.js";
import { SnapshotGenerator } from "../apps/api/src/services/snapshot-generator.js";

const canonicalResume = {
  resume: { id: "resume-1", userId: "user-1", title: "Master Resume", resumeType: "master" },
  sections: [{
    id: "section-1",
    sectionType: "experience",
    title: "Experience",
    visibility: "visible",
    entities: [{
      id: "entity-1",
      sectionId: "section-1",
      entityType: "experience",
      visibility: "visible",
      bullets: [{
        id: "bullet-1",
        text: "Built backend APIs with Python.",
        visibility: "visible"
      }]
    }]
  }]
};

test("conflict detector rejects already modified targets", () => {
  assert.throws(() => new ConflictDetector().detect({
    canonicalResume,
    acceptedPatches: [{
      id: "patch-1",
      operation: "replace_bullet",
      target: { bulletId: "bullet-1" },
      before: "Different text",
      after: "New text"
    }]
  }), /conflicts/);
});

test("patch applier applies accepted patches to snapshot only", () => {
  const applied = new PatchApplier().apply({
    canonicalResume,
    acceptedPatches: [{
      id: "patch-1",
      operation: "replace_bullet",
      target: { bulletId: "bullet-1" },
      before: "Built backend APIs with Python.",
      after: "Built backend APIs with Python and production deployment context.",
      reason: "Clarify deployment",
      evidence: []
    }]
  });

  assert.equal(applied.snapshot.sections[0].entities[0].bullets[0].text, "Built backend APIs with Python and production deployment context.");
  assert.equal(canonicalResume.sections[0].entities[0].bullets[0].text, "Built backend APIs with Python.");
  assert.equal(applied.operations.length, 1);
});

test("snapshot generator produces stable hash", () => {
  const generator = new SnapshotGenerator();
  const first = generator.generate({ resume: canonicalResume.resume, version: { id: "v1", metadata: {} }, sections: canonicalResume.sections });
  const second = generator.generate({ resume: canonicalResume.resume, version: { id: "v2", metadata: {} }, sections: canonicalResume.sections });
  assert.equal(first.snapshotHash, second.snapshotHash);
});

test("renderer produces html json and pdf artifacts", () => {
  const snapshot = new SnapshotGenerator().generate({
    resume: canonicalResume.resume,
    version: { id: "v1", metadata: {} },
    sections: canonicalResume.sections
  }).snapshot;
  const outputs = new RendererService().renderAll({ snapshot });
  assert.deepEqual(outputs.map((item) => item.format).sort(), ["html", "json", "pdf"]);
  assert.ok(outputs.find((item) => item.format === "pdf").content.startsWith("%PDF"));
});
