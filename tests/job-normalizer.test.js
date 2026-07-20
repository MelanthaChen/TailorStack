import assert from "node:assert/strict";
import test from "node:test";
import { dedupeNormalized, findKnownSkills, skillBuckets } from "../apps/api/src/services/job-normalizer.js";

test("normalizer resolves aliases and removes duplicates", () => {
  assert.deepEqual(dedupeNormalized(["JS", "JavaScript", "TS", "AWS", "Amazon Web Services", "Node"]), [
    "JavaScript",
    "TypeScript",
    "Amazon Web Services",
    "Node.js"
  ]);
});

test("normalizer extracts known skills into buckets", () => {
  const skills = findKnownSkills("We use JS, TS, React, AWS, Docker, Kubernetes, and PostgreSQL.");
  const buckets = skillBuckets(skills);
  assert.ok(buckets.programmingLanguages.includes("JavaScript"));
  assert.ok(buckets.frameworks.includes("React"));
  assert.ok(buckets.cloudPlatforms.includes("Amazon Web Services"));
  assert.ok(buckets.tools.includes("Docker"));
});
