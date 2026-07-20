export const supportedPatchOperations = Object.freeze([
  "replace_bullet",
  "insert_bullet",
  "delete_bullet",
  "move_bullet",
  "replace_summary",
  "replace_skill",
  "insert_skill",
  "remove_skill"
]);

export class PatchValidator {
  validatePatch(patch, canonicalResume) {
    const errors = [];
    if (!supportedPatchOperations.includes(patch.operation)) errors.push("Unsupported patch operation");
    if (!patch.target || typeof patch.target !== "object") errors.push("Patch target is required");
    if (!patch.reason || typeof patch.reason !== "string") errors.push("Patch reason is required");
    if (!Array.isArray(patch.evidence) || patch.evidence.length === 0) errors.push("Patch evidence is required");
    if (typeof patch.confidence !== "number" || patch.confidence < 0 || patch.confidence > 1) {
      errors.push("Patch confidence must be between 0 and 1");
    }
    validateTarget(patch, canonicalResume, errors);
    validateContent(patch, canonicalResume, errors);
    if (errors.length) throwValidation(errors);
    return patch;
  }
}

function validateTarget(patch, canonicalResume, errors) {
  if (patch.operation.includes("bullet") && patch.operation !== "insert_bullet") {
    const bullet = findBullet(canonicalResume.sections, patch.target.bulletId);
    if (!bullet) errors.push("Patch references missing bullet target");
  }
  if (patch.operation === "insert_bullet") {
    const entity = findEntity(canonicalResume.sections, patch.target.entityId);
    if (!entity) errors.push("Patch references missing entity target");
  }
  if (patch.operation.includes("skill")) {
    const skillSection = canonicalResume.sections.find((section) => section.sectionType === "skills");
    if (!skillSection && patch.operation !== "insert_skill") errors.push("Patch references missing skills section");
  }
}

function validateContent(patch, canonicalResume, errors) {
  const after = String(patch.after ?? "").trim();
  const before = String(patch.before ?? "").trim();
  if (["replace_bullet", "replace_summary", "replace_skill", "insert_skill", "insert_bullet"].includes(patch.operation) && !after) {
    errors.push("Patch after value is required");
  }
  if (patch.operation === "replace_bullet") {
    const bullet = findBullet(canonicalResume.sections, patch.target.bulletId);
    if (bullet && before && bullet.text !== before) errors.push("Patch before value does not match canonical bullet");
  }
  if (after && canonicalText(canonicalResume).includes(normalize(after)) && ["insert_skill", "insert_bullet"].includes(patch.operation)) {
    errors.push("Patch duplicates existing canonical content");
  }
}

export function findBullet(sections, bulletId) {
  for (const section of sections ?? []) {
    for (const entity of section.entities ?? []) {
      const bullet = (entity.bullets ?? []).find((item) => item.id === bulletId && item.visibility !== "hidden");
      if (bullet) return bullet;
    }
  }
  return null;
}

export function findEntity(sections, entityId) {
  for (const section of sections ?? []) {
    const entity = (section.entities ?? []).find((item) => item.id === entityId && item.visibility !== "hidden");
    if (entity) return entity;
  }
  return null;
}

function canonicalText(canonicalResume) {
  return normalize((canonicalResume.sections ?? []).flatMap((section) => [
    section.title,
    ...(section.entities ?? []).flatMap((entity) => [
      entity.title,
      entity.organization,
      ...(entity.bullets ?? []).map((bullet) => bullet.text)
    ])
  ]).filter(Boolean).join("\n"));
}

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function throwValidation(errors) {
  const error = new Error(`Optimization patch failed validation: ${errors.join("; ")}`);
  error.code = "validation_error";
  error.statusCode = 422;
  error.details = { errors };
  throw error;
}
