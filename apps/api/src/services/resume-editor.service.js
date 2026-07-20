import {
  throwNotFound,
  throwValidation,
  validateCanonicalResume,
  validateDisplayOrders,
  validateOrderedIds,
  validateVisibility
} from "./resume-editor-validator.js";

export class ResumeEditorService {
  constructor({ resumeRepository, resumeParserRepository, resumeEditorRepository, auditRepository, logger }) {
    this.resumeRepository = resumeRepository;
    this.resumeParserRepository = resumeParserRepository;
    this.resumeEditorRepository = resumeEditorRepository;
    this.auditRepository = auditRepository;
    this.logger = logger;
  }

  async getCanonicalResume({ user, resumeId }) {
    const resume = await this.requireCanonicalResume(user, resumeId);
    const sections = await this.resumeParserRepository.getParsedDraft(user.id, resumeId);
    this.validateRelationships(sections);
    return { resume, sections };
  }

  async createSection({ user, resumeId, input, requestId }) {
    await this.requireCanonicalResume(user, resumeId);
    const sections = await this.resumeEditorRepository.listSections(user.id, resumeId);
    const section = await this.resumeEditorRepository.createSection({
      userId: user.id,
      resumeId,
      title: input.title || "Untitled Section",
      sectionType: input.sectionType || "custom",
      displayOrder: sections.length
    });
    await this.audit(user, requestId, "resume_section_created", "resume_section", section.id, { resumeId });
    return this.getCanonicalResume({ user, resumeId });
  }

  async updateSection({ user, sectionId, input, requestId }) {
    const section = await this.requireSection(user, sectionId);
    await this.requireCanonicalResume(user, section.resumeId);
    const changes = pick(input, ["title", "sectionType"]);
    const updated = await this.resumeEditorRepository.updateSection(sectionId, user.id, changes);
    await this.audit(user, requestId, "resume_section_updated", "resume_section", sectionId, { before: section, after: updated });
    return this.getCanonicalResume({ user, resumeId: section.resumeId });
  }

  async deleteSection({ user, sectionId, requestId }) {
    const section = await this.requireSection(user, sectionId);
    await this.requireCanonicalResume(user, section.resumeId);
    await this.resumeEditorRepository.softDeleteSection(sectionId, user.id);
    await this.audit(user, requestId, "resume_section_deleted", "resume_section", sectionId, { resumeId: section.resumeId });
    await this.compactSectionOrders(user.id, section.resumeId);
    return this.getCanonicalResume({ user, resumeId: section.resumeId });
  }

  async setSectionVisibility({ user, sectionId, visibility, requestId }) {
    validateVisibility(visibility);
    const section = await this.requireSection(user, sectionId);
    await this.requireCanonicalResume(user, section.resumeId);
    await this.resumeEditorRepository.updateSection(sectionId, user.id, { visibility });
    await this.audit(user, requestId, "resume_section_visibility_updated", "resume_section", sectionId, { visibility });
    return this.getCanonicalResume({ user, resumeId: section.resumeId });
  }

  async reorderSections({ user, resumeId, orderedIds, requestId }) {
    await this.requireCanonicalResume(user, resumeId);
    validateOrderedIds(orderedIds);
    const sections = await this.resumeEditorRepository.listSections(user.id, resumeId);
    assertSameIds(sections.map((item) => item.id), orderedIds, "sections");
    await Promise.all(orderedIds.map((id, index) => this.resumeEditorRepository.updateSection(id, user.id, { displayOrder: index })));
    await this.audit(user, requestId, "resume_sections_reordered", "resume", resumeId, { orderedIds });
    return this.getCanonicalResume({ user, resumeId });
  }

  async createEntity({ user, sectionId, input, requestId }) {
    const section = await this.requireSection(user, sectionId);
    await this.requireCanonicalResume(user, section.resumeId);
    const entities = await this.resumeEditorRepository.listEntities(user.id, sectionId);
    const entity = await this.resumeEditorRepository.createEntity({
      userId: user.id,
      resumeId: section.resumeId,
      sectionId,
      entityType: input.entityType || entityTypeForSection(section.sectionType),
      title: input.title ?? null,
      organization: input.organization ?? null,
      location: input.location ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      datePrecision: input.datePrecision ?? null,
      isCurrent: Boolean(input.isCurrent),
      url: input.url ?? null,
      displayOrder: entities.length
    });
    await this.audit(user, requestId, "resume_entity_created", "resume_entity", entity.id, { sectionId });
    return this.getCanonicalResume({ user, resumeId: section.resumeId });
  }

  async updateEntity({ user, entityId, input, requestId }) {
    const entity = await this.requireEntity(user, entityId);
    await this.requireCanonicalResume(user, entity.resumeId);
    const changes = pick(input, ["entityType", "title", "organization", "location", "startDate", "endDate", "datePrecision", "isCurrent", "url"]);
    const updated = await this.resumeEditorRepository.updateEntity(entityId, user.id, changes);
    await this.audit(user, requestId, "resume_entity_updated", "resume_entity", entityId, { before: entity, after: updated });
    return this.getCanonicalResume({ user, resumeId: entity.resumeId });
  }

  async deleteEntity({ user, entityId, requestId }) {
    const entity = await this.requireEntity(user, entityId);
    await this.requireCanonicalResume(user, entity.resumeId);
    await this.resumeEditorRepository.softDeleteEntity(entityId, user.id);
    await this.audit(user, requestId, "resume_entity_deleted", "resume_entity", entityId, { resumeId: entity.resumeId });
    await this.compactEntityOrders(user.id, entity.sectionId);
    return this.getCanonicalResume({ user, resumeId: entity.resumeId });
  }

  async reorderEntities({ user, sectionId, orderedIds, requestId }) {
    const section = await this.requireSection(user, sectionId);
    await this.requireCanonicalResume(user, section.resumeId);
    validateOrderedIds(orderedIds);
    const entities = await this.resumeEditorRepository.listEntities(user.id, sectionId);
    assertSameIds(entities.map((item) => item.id), orderedIds, "entities");
    await Promise.all(orderedIds.map((id, index) => this.resumeEditorRepository.updateEntity(id, user.id, { displayOrder: index })));
    await this.audit(user, requestId, "resume_entities_reordered", "resume_section", sectionId, { orderedIds });
    return this.getCanonicalResume({ user, resumeId: section.resumeId });
  }

  async createBullet({ user, entityId, input, requestId }) {
    const entity = await this.requireEntity(user, entityId);
    await this.requireCanonicalResume(user, entity.resumeId);
    if (!input.text || typeof input.text !== "string") throwValidation("Bullet text is required");
    const bullets = await this.resumeEditorRepository.listBullets(user.id, entityId);
    const bullet = await this.resumeEditorRepository.createBullet({
      userId: user.id,
      resumeId: entity.resumeId,
      sectionId: entity.sectionId,
      entityId,
      text: input.text,
      category: input.category ?? entity.entityType,
      displayOrder: bullets.length
    });
    await this.audit(user, requestId, "resume_bullet_created", "resume_bullet", bullet.id, { entityId });
    return this.getCanonicalResume({ user, resumeId: entity.resumeId });
  }

  async updateBullet({ user, bulletId, input, requestId }) {
    const bullet = await this.requireBullet(user, bulletId);
    await this.requireCanonicalResume(user, bullet.resumeId);
    const changes = pick(input, ["text", "category"]);
    if (changes.text !== undefined && !changes.text.trim()) throwValidation("Bullet text is required");
    const updated = await this.resumeEditorRepository.updateBullet(bulletId, user.id, changes);
    await this.audit(user, requestId, "resume_bullet_updated", "resume_bullet", bulletId, { before: bullet, after: updated });
    return this.getCanonicalResume({ user, resumeId: bullet.resumeId });
  }

  async deleteBullet({ user, bulletId, requestId }) {
    const bullet = await this.requireBullet(user, bulletId);
    await this.requireCanonicalResume(user, bullet.resumeId);
    await this.resumeEditorRepository.softDeleteBullet(bulletId, user.id);
    await this.audit(user, requestId, "resume_bullet_deleted", "resume_bullet", bulletId, { resumeId: bullet.resumeId });
    await this.compactBulletOrders(user.id, bullet.entityId);
    return this.getCanonicalResume({ user, resumeId: bullet.resumeId });
  }

  async setBulletVisibility({ user, bulletId, visibility, requestId }) {
    validateVisibility(visibility);
    const bullet = await this.requireBullet(user, bulletId);
    await this.requireCanonicalResume(user, bullet.resumeId);
    await this.resumeEditorRepository.updateBullet(bulletId, user.id, { visibility });
    await this.audit(user, requestId, "resume_bullet_visibility_updated", "resume_bullet", bulletId, { visibility });
    return this.getCanonicalResume({ user, resumeId: bullet.resumeId });
  }

  async reorderBullets({ user, entityId, orderedIds, requestId }) {
    const entity = await this.requireEntity(user, entityId);
    await this.requireCanonicalResume(user, entity.resumeId);
    validateOrderedIds(orderedIds);
    const bullets = await this.resumeEditorRepository.listBullets(user.id, entityId);
    assertSameIds(bullets.map((item) => item.id), orderedIds, "bullets");
    await Promise.all(orderedIds.map((id, index) => this.resumeEditorRepository.updateBullet(id, user.id, { displayOrder: index })));
    await this.audit(user, requestId, "resume_bullets_reordered", "resume_entity", entityId, { orderedIds });
    return this.getCanonicalResume({ user, resumeId: entity.resumeId });
  }

  validateRelationships(sections) {
    validateDisplayOrders(sections, "sections");
    for (const section of sections) {
      validateDisplayOrders(section.entities, `entities for section ${section.id}`);
      for (const entity of section.entities) {
        if (entity.sectionId !== section.id) throwValidation("Invalid entity parent reference");
        validateDisplayOrders(entity.bullets, `bullets for entity ${entity.id}`);
        for (const bullet of entity.bullets) {
          if (bullet.sectionId !== section.id || bullet.entityId !== entity.id) {
            throwValidation("Invalid bullet parent reference");
          }
        }
      }
    }
  }

  async requireCanonicalResume(user, resumeId) {
    const resume = await this.resumeRepository.findResumeForUser(resumeId, user.id);
    validateCanonicalResume(resume);
    return resume;
  }

  async requireSection(user, sectionId) {
    const section = await this.resumeEditorRepository.getSection(sectionId, user.id);
    if (!section) throwNotFound("Section not found");
    return section;
  }

  async requireEntity(user, entityId) {
    const entity = await this.resumeEditorRepository.getEntity(entityId, user.id);
    if (!entity) throwNotFound("Entity not found");
    return entity;
  }

  async requireBullet(user, bulletId) {
    const bullet = await this.resumeEditorRepository.getBullet(bulletId, user.id);
    if (!bullet) throwNotFound("Bullet not found");
    return bullet;
  }

  async compactSectionOrders(userId, resumeId) {
    const sections = await this.resumeEditorRepository.listSections(userId, resumeId);
    await Promise.all(sections.map((section, index) => this.resumeEditorRepository.updateSection(section.id, userId, { displayOrder: index })));
  }

  async compactEntityOrders(userId, sectionId) {
    const entities = await this.resumeEditorRepository.listEntities(userId, sectionId);
    await Promise.all(entities.map((entity, index) => this.resumeEditorRepository.updateEntity(entity.id, userId, { displayOrder: index })));
  }

  async compactBulletOrders(userId, entityId) {
    const bullets = await this.resumeEditorRepository.listBullets(userId, entityId);
    await Promise.all(bullets.map((bullet, index) => this.resumeEditorRepository.updateBullet(bullet.id, userId, { displayOrder: index })));
  }

  async audit(user, requestId, eventType, resourceType, resourceId, metadata) {
    await this.auditRepository.createAuditEvent({
      userId: user.id,
      actorUserId: user.id,
      eventType,
      resourceType,
      resourceId,
      requestId,
      metadata
    });
    this.logger.info("resume_edit_audited", { requestId, userId: user.id, eventType, resourceType, resourceId });
  }
}

function pick(input, keys) {
  return Object.fromEntries(keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
}

function assertSameIds(existingIds, orderedIds, label) {
  const existing = [...existingIds].sort();
  const ordered = [...orderedIds].sort();
  if (existing.length !== ordered.length || existing.some((id, index) => id !== ordered[index])) {
    throwValidation(`Ordered ${label} must match existing ${label}`);
  }
}

function entityTypeForSection(sectionType) {
  if (sectionType === "projects") return "project";
  if (sectionType === "education") return "education";
  if (sectionType === "skills") return "skill_group";
  if (sectionType === "certifications") return "certification";
  if (sectionType === "awards") return "award";
  return "experience";
}
