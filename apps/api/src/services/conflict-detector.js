export class ConflictDetector {
  detect({ canonicalResume, acceptedPatches }) {
    const conflicts = [];
    const seenInsertions = new Set();
    const seenTargets = new Set();

    for (const patch of acceptedPatches) {
      const targetKey = `${patch.operation}:${JSON.stringify(patch.target ?? {})}`;
      if (seenTargets.has(targetKey) && patch.operation !== "insert_bullet" && patch.operation !== "insert_skill") {
        conflicts.push(conflict(patch, "duplicate_target", "Multiple accepted patches modify the same target"));
      }
      seenTargets.add(targetKey);

      if (patch.operation.includes("bullet") && patch.operation !== "insert_bullet") {
        const bullet = findBullet(canonicalResume.sections, patch.target?.bulletId);
        if (!bullet) conflicts.push(conflict(patch, "missing_target", "Accepted patch references a missing bullet"));
        if (bullet && patch.before !== null && patch.before !== undefined && bullet.text !== patch.before) {
          conflicts.push(conflict(patch, "already_modified_target", "Accepted patch before value does not match canonical bullet"));
        }
      }

      if (patch.operation === "insert_bullet" && !findEntity(canonicalResume.sections, patch.target?.entityId)) {
        conflicts.push(conflict(patch, "invalid_reference", "Accepted insert_bullet patch references a missing entity"));
      }

      if (patch.operation.startsWith("insert_")) {
        const insertionKey = `${patch.operation}:${String(patch.after ?? "").trim().toLowerCase()}`;
        if (seenInsertions.has(insertionKey)) {
          conflicts.push(conflict(patch, "duplicate_insertion", "Accepted patch duplicates another insertion"));
        }
        seenInsertions.add(insertionKey);
      }
    }

    if (conflicts.length) {
      const error = new Error("Accepted patches contain conflicts");
      error.code = "validation_error";
      error.statusCode = 422;
      error.details = { conflicts };
      throw error;
    }
    return [];
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

function conflict(patch, code, message) {
  return {
    patchId: patch.id,
    code,
    message
  };
}
