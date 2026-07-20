export class PatchApplier {
  apply({ canonicalResume, acceptedPatches }) {
    const snapshot = structuredClone({
      resume: canonicalResume.resume,
      sections: canonicalResume.sections
    });
    const operations = [];

    for (const patch of acceptedPatches) {
      if (patch.operation === "replace_bullet") {
        const bullet = findBullet(snapshot.sections, patch.target.bulletId);
        bullet.text = patch.after;
        bullet.normalizedText = normalize(patch.after);
        operations.push(diffOperation(patch, "replace", `/bullets/${patch.target.bulletId}/text`));
      }
      if (patch.operation === "insert_bullet") {
        const entity = findEntity(snapshot.sections, patch.target.entityId);
        const section = findSection(snapshot.sections, patch.target.sectionId);
        const bullet = {
          id: `snapshot-${crypto.randomUUID()}`,
          resumeId: snapshot.resume.id,
          sectionId: section?.id ?? entity.sectionId,
          entityId: entity.id,
          userId: snapshot.resume.userId,
          text: patch.after,
          normalizedText: normalize(patch.after),
          displayOrder: entity.bullets.length,
          visibility: "visible",
          category: entity.entityType,
          priority: null,
          confidence: patch.confidence,
          actionVerb: firstWord(patch.after),
          source: "optimization_patch",
          parentBulletId: null,
          metadata: { patchId: patch.id },
          truthConstraints: { mayRewrite: true, mayReorder: true, mayHide: true },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null
        };
        entity.bullets.push(bullet);
        operations.push(diffOperation(patch, "add", `/entities/${entity.id}/bullets/-`));
      }
      if (patch.operation === "delete_bullet") {
        const bullet = findBullet(snapshot.sections, patch.target.bulletId);
        bullet.visibility = "hidden";
        operations.push(diffOperation(patch, "replace", `/bullets/${patch.target.bulletId}/visibility`));
      }
      if (patch.operation === "move_bullet") {
        operations.push(diffOperation(patch, "move", `/bullets/${patch.target.bulletId}`));
      }
      if (patch.operation === "replace_summary") {
        const summary = findOrCreateSection(snapshot, "summary", "Summary");
        const entity = summary.entities[0] ?? createEntity(snapshot.resume, summary, "summary");
        if (!summary.entities.length) summary.entities.push(entity);
        if (entity.bullets[0]) {
          entity.bullets[0].text = patch.after;
        } else {
          entity.bullets.push(createBullet(snapshot.resume, summary, entity, patch.after, patch.confidence));
        }
        operations.push(diffOperation(patch, "replace", "/sections/summary"));
      }
      if (patch.operation === "insert_skill" || patch.operation === "replace_skill") {
        const skills = findOrCreateSection(snapshot, "skills", "Skills");
        const entity = skills.entities[0] ?? createEntity(snapshot.resume, skills, "skill_group");
        if (!skills.entities.length) skills.entities.push(entity);
        entity.bullets.push(createBullet(snapshot.resume, skills, entity, patch.after, patch.confidence));
        operations.push(diffOperation(patch, "add", "/sections/skills"));
      }
      if (patch.operation === "remove_skill") {
        operations.push(diffOperation(patch, "remove", "/sections/skills"));
      }
    }

    return { snapshot, operations };
  }
}

function findSection(sections, sectionId) {
  return (sections ?? []).find((section) => section.id === sectionId) ?? null;
}

function findOrCreateSection(snapshot, sectionType, title) {
  let section = snapshot.sections.find((item) => item.sectionType === sectionType);
  if (section) return section;
  section = {
    id: `snapshot-${crypto.randomUUID()}`,
    resumeId: snapshot.resume.id,
    userId: snapshot.resume.userId,
    sectionType,
    title,
    displayOrder: snapshot.sections.length,
    visibility: "visible",
    source: "optimization_patch",
    confidence: 1,
    metadata: {},
    entities: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
  snapshot.sections.push(section);
  return section;
}

function createEntity(resume, section, entityType) {
  return {
    id: `snapshot-${crypto.randomUUID()}`,
    resumeId: resume.id,
    sectionId: section.id,
    userId: resume.userId,
    entityType,
    title: section.title,
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    displayOrder: section.entities.length,
    visibility: "visible",
    source: "optimization_patch",
    confidence: 1,
    metadata: {},
    bullets: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
}

function createBullet(resume, section, entity, text, confidence) {
  return {
    id: `snapshot-${crypto.randomUUID()}`,
    resumeId: resume.id,
    sectionId: section.id,
    entityId: entity.id,
    userId: resume.userId,
    text,
    normalizedText: normalize(text),
    displayOrder: entity.bullets.length,
    visibility: "visible",
    category: entity.entityType,
    confidence,
    actionVerb: firstWord(text),
    source: "optimization_patch",
    metadata: {},
    truthConstraints: { mayRewrite: true, mayReorder: true, mayHide: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
}

function diffOperation(patch, op, path) {
  return {
    op,
    path,
    patchId: patch.id,
    operation: patch.operation,
    before: patch.before,
    after: patch.after,
    reason: patch.reason,
    evidence: patch.evidence
  };
}

function findBullet(sections, bulletId) {
  for (const section of sections ?? []) {
    for (const entity of section.entities ?? []) {
      const bullet = (entity.bullets ?? []).find((item) => item.id === bulletId);
      if (bullet) return bullet;
    }
  }
  return null;
}

function findEntity(sections, entityId) {
  for (const section of sections ?? []) {
    const entity = (section.entities ?? []).find((item) => item.id === entityId);
    if (entity) return entity;
  }
  return null;
}

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function firstWord(value) {
  return String(value ?? "").trim().split(/\s+/)[0] ?? null;
}
