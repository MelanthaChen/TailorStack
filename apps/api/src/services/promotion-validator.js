export function validateDraftForPromotion({ resume, parseJob, sections }) {
  const errors = [];
  const warnings = [];

  if (!resume) errors.push("Resume is required");
  if (resume?.status !== "review_required") {
    errors.push("Resume must be in review_required status before promotion");
  }
  if (!parseJob || parseJob.status !== "succeeded") {
    errors.push("Parser job must have succeeded before promotion");
  }
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push("Parsed draft must include at least one section");
  }

  const sectionTypes = new Set();
  const entityKeys = new Set();
  const sectionIds = new Set();
  const entityIds = new Set();
  let bulletCount = 0;

  for (const section of sections ?? []) {
    if (!isConfidence(section.confidence)) errors.push(`Section ${section.title ?? section.id} has invalid confidence`);
    if (section.confidence < 0.5) warnings.push(`Section ${section.title} has low confidence`);
    sectionTypes.add(section.sectionType);
    sectionIds.add(section.id);
    if (!Array.isArray(section.entities) || section.entities.length === 0) {
      warnings.push(`Section ${section.title} has no entities`);
      continue;
    }
    for (const entity of section.entities) {
      if (entity.sectionId !== section.id) errors.push(`Entity ${entity.id} is linked to the wrong section`);
      if (!isConfidence(entity.confidence)) errors.push(`Entity ${entity.title ?? entity.id} has invalid confidence`);
      if (entity.confidence < 0.5) warnings.push(`Entity ${entity.title ?? entity.entityType} has low confidence`);
      const key = [
        entity.entityType,
        entity.title ?? "",
        entity.organization ?? "",
        entity.startDate ?? "",
        entity.endDate ?? ""
      ].join("|").toLowerCase();
      if (entityKeys.has(key)) {
        errors.push(`Duplicate entity detected: ${entity.title ?? entity.entityType}`);
      }
      entityKeys.add(key);
      entityIds.add(entity.id);
      if (!Array.isArray(entity.bullets)) {
        errors.push(`Entity ${entity.id} has invalid bullets`);
        continue;
      }
      for (const bullet of entity.bullets) {
        bulletCount += 1;
        if (bullet.sectionId !== section.id) errors.push(`Bullet ${bullet.id} is linked to the wrong section`);
        if (bullet.entityId !== entity.id) errors.push(`Bullet ${bullet.id} is linked to the wrong entity`);
        if (!sectionIds.has(bullet.sectionId)) errors.push(`Bullet ${bullet.id} has orphan section relationship`);
        if (!entityIds.has(bullet.entityId)) errors.push(`Bullet ${bullet.id} has orphan entity relationship`);
        if (!bullet.text || typeof bullet.text !== "string") errors.push(`Bullet ${bullet.id} is missing text`);
        if (!isConfidence(bullet.confidence)) errors.push(`Bullet ${bullet.id} has invalid confidence`);
        if (bullet.confidence < 0.5) warnings.push(`Bullet "${bullet.text}" has low confidence`);
      }
    }
  }

  if (!sectionTypes.has("experience") && !sectionTypes.has("projects") && !sectionTypes.has("education")) {
    warnings.push("Draft is missing common resume sections such as experience, projects, or education");
  }
  if (bulletCount === 0) errors.push("Parsed draft must include at least one bullet");

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function isConfidence(value) {
  return typeof value === "number" && value >= 0 && value <= 1;
}
