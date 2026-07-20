import { queryJson, sql } from "./sql-utils.js";

export class InMemoryResumeEditorRepository {
  constructor({ resumeParserRepository }) {
    this.sections = resumeParserRepository.sections;
    this.entities = resumeParserRepository.entities;
    this.bullets = resumeParserRepository.bullets;
  }

  async createSection(input) {
    const now = new Date().toISOString();
    const section = {
      id: crypto.randomUUID(),
      resumeId: input.resumeId,
      userId: input.userId,
      sectionType: input.sectionType ?? "custom",
      title: input.title,
      displayOrder: input.displayOrder,
      visibility: "visible",
      source: "user_created",
      confidence: 1,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.sections.set(section.id, section);
    return section;
  }

  async updateSection(id, userId, changes) {
    return updateMapRecord(this.sections, id, userId, changes);
  }

  async softDeleteSection(id, userId) {
    const section = await this.updateSection(id, userId, { deletedAt: new Date().toISOString() });
    for (const entity of this.entities.values()) {
      if (entity.sectionId === id && entity.userId === userId && !entity.deletedAt) {
        entity.deletedAt = section.deletedAt;
        entity.updatedAt = section.updatedAt;
      }
    }
    for (const bullet of this.bullets.values()) {
      if (bullet.sectionId === id && bullet.userId === userId && !bullet.deletedAt) {
        bullet.deletedAt = section.deletedAt;
        bullet.updatedAt = section.updatedAt;
      }
    }
    return section;
  }

  async createEntity(input) {
    const now = new Date().toISOString();
    const entity = {
      id: crypto.randomUUID(),
      resumeId: input.resumeId,
      sectionId: input.sectionId,
      userId: input.userId,
      entityType: input.entityType,
      title: input.title ?? null,
      organization: input.organization ?? null,
      location: input.location ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      datePrecision: input.datePrecision ?? null,
      isCurrent: input.isCurrent ?? false,
      url: input.url ?? null,
      displayOrder: input.displayOrder,
      visibility: "visible",
      source: "user_created",
      confidence: 1,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.entities.set(entity.id, entity);
    return entity;
  }

  async updateEntity(id, userId, changes) {
    return updateMapRecord(this.entities, id, userId, changes);
  }

  async softDeleteEntity(id, userId) {
    const entity = await this.updateEntity(id, userId, { deletedAt: new Date().toISOString() });
    for (const bullet of this.bullets.values()) {
      if (bullet.entityId === id && bullet.userId === userId && !bullet.deletedAt) {
        bullet.deletedAt = entity.deletedAt;
        bullet.updatedAt = entity.updatedAt;
      }
    }
    return entity;
  }

  async createBullet(input) {
    const now = new Date().toISOString();
    const bullet = {
      id: crypto.randomUUID(),
      resumeId: input.resumeId,
      sectionId: input.sectionId,
      entityId: input.entityId,
      userId: input.userId,
      text: input.text,
      normalizedText: normalize(input.text),
      displayOrder: input.displayOrder,
      visibility: "visible",
      category: input.category ?? null,
      priority: null,
      confidence: 1,
      actionVerb: firstWord(input.text),
      source: "user_created",
      parentBulletId: null,
      metadata: {},
      truthConstraints: defaultTruthConstraints(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.bullets.set(bullet.id, bullet);
    return bullet;
  }

  async updateBullet(id, userId, changes) {
    const normalized = changes.text !== undefined
      ? { ...changes, normalizedText: normalize(changes.text), actionVerb: firstWord(changes.text) }
      : changes;
    return updateMapRecord(this.bullets, id, userId, normalized);
  }

  async softDeleteBullet(id, userId) {
    return this.updateBullet(id, userId, { deletedAt: new Date().toISOString() });
  }

  async getSection(id, userId) {
    return getActive(this.sections, id, userId);
  }

  async getEntity(id, userId) {
    return getActive(this.entities, id, userId);
  }

  async getBullet(id, userId) {
    return getActive(this.bullets, id, userId);
  }

  async listSections(userId, resumeId) {
    return [...this.sections.values()]
      .filter((item) => item.userId === userId && item.resumeId === resumeId && !item.deletedAt)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async listEntities(userId, sectionId) {
    return [...this.entities.values()]
      .filter((item) => item.userId === userId && item.sectionId === sectionId && !item.deletedAt)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async listBullets(userId, entityId) {
    return [...this.bullets.values()]
      .filter((item) => item.userId === userId && item.entityId === entityId && !item.deletedAt)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }
}

export class PostgresResumeEditorRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createSection(input) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO resume_sections (id, resume_id, user_id, section_type, title, display_order, visibility, source, confidence, metadata, created_at, updated_at)
      VALUES (${sql(crypto.randomUUID())}, ${sql(input.resumeId)}, ${sql(input.userId)}, ${sql(input.sectionType ?? "custom")}, ${sql(input.title)}, ${input.displayOrder}, 'visible', 'user_created', 1, '{}'::jsonb, ${sql(now)}, ${sql(now)})
      RETURNING ${sectionJson()}
    `);
    return rows[0];
  }

  async updateSection(id, userId, changes) {
    return this.updateRecord("resume_sections", sectionJson(), id, userId, sectionColumns(changes));
  }

  async softDeleteSection(id, userId) {
    const deletedAt = new Date().toISOString();
    const section = await this.updateRecord("resume_sections", sectionJson(), id, userId, { deleted_at: deletedAt });
    await queryJson(this.databaseUrl, `UPDATE resume_entities SET deleted_at = ${sql(deletedAt)}, updated_at = ${sql(deletedAt)} WHERE section_id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL RETURNING json_build_object('ok', true) AS value`);
    await queryJson(this.databaseUrl, `UPDATE resume_bullets SET deleted_at = ${sql(deletedAt)}, updated_at = ${sql(deletedAt)} WHERE section_id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL RETURNING json_build_object('ok', true) AS value`);
    return section;
  }

  async createEntity(input) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO resume_entities (id, resume_id, section_id, user_id, entity_type, title, organization, location, start_date, end_date, date_precision, is_current, url, display_order, visibility, source, confidence, metadata, created_at, updated_at)
      VALUES (${sql(crypto.randomUUID())}, ${sql(input.resumeId)}, ${sql(input.sectionId)}, ${sql(input.userId)}, ${sql(input.entityType)}, ${sql(input.title ?? null)}, ${sql(input.organization ?? null)}, ${sql(input.location ?? null)}, ${sql(input.startDate ?? null)}, ${sql(input.endDate ?? null)}, ${sql(input.datePrecision ?? null)}, ${input.isCurrent ? "true" : "false"}, ${sql(input.url ?? null)}, ${input.displayOrder}, 'visible', 'user_created', 1, '{}'::jsonb, ${sql(now)}, ${sql(now)})
      RETURNING ${entityJson()}
    `);
    return rows[0];
  }

  async updateEntity(id, userId, changes) {
    return this.updateRecord("resume_entities", entityJson(), id, userId, entityColumns(changes));
  }

  async softDeleteEntity(id, userId) {
    const deletedAt = new Date().toISOString();
    const entity = await this.updateRecord("resume_entities", entityJson(), id, userId, { deleted_at: deletedAt });
    await queryJson(this.databaseUrl, `UPDATE resume_bullets SET deleted_at = ${sql(deletedAt)}, updated_at = ${sql(deletedAt)} WHERE entity_id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL RETURNING json_build_object('ok', true) AS value`);
    return entity;
  }

  async createBullet(input) {
    const now = new Date().toISOString();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO resume_bullets (id, resume_id, section_id, entity_id, user_id, text, normalized_text, display_order, visibility, category, priority, confidence, action_verb, source, metadata, truth_constraints, created_at, updated_at)
      VALUES (${sql(crypto.randomUUID())}, ${sql(input.resumeId)}, ${sql(input.sectionId)}, ${sql(input.entityId)}, ${sql(input.userId)}, ${sql(input.text)}, ${sql(normalize(input.text))}, ${input.displayOrder}, 'visible', ${sql(input.category ?? null)}, NULL, 1, ${sql(firstWord(input.text))}, 'user_created', '{}'::jsonb, ${sql(defaultTruthConstraints())}::jsonb, ${sql(now)}, ${sql(now)})
      RETURNING ${bulletJson()}
    `);
    return rows[0];
  }

  async updateBullet(id, userId, changes) {
    const normalized = changes.text !== undefined
      ? { ...changes, normalizedText: normalize(changes.text), actionVerb: firstWord(changes.text) }
      : changes;
    return this.updateRecord("resume_bullets", bulletJson(), id, userId, bulletColumns(normalized));
  }

  async softDeleteBullet(id, userId) {
    return this.updateRecord("resume_bullets", bulletJson(), id, userId, { deleted_at: new Date().toISOString() });
  }

  async getSection(id, userId) {
    return this.getRecord("resume_sections", sectionJson(), id, userId);
  }

  async getEntity(id, userId) {
    return this.getRecord("resume_entities", entityJson(), id, userId);
  }

  async getBullet(id, userId) {
    return this.getRecord("resume_bullets", bulletJson(), id, userId);
  }

  async listSections(userId, resumeId) {
    return queryJson(this.databaseUrl, `SELECT ${sectionJson()} FROM resume_sections WHERE user_id = ${sql(userId)} AND resume_id = ${sql(resumeId)} AND deleted_at IS NULL ORDER BY display_order`);
  }

  async listEntities(userId, sectionId) {
    return queryJson(this.databaseUrl, `SELECT ${entityJson()} FROM resume_entities WHERE user_id = ${sql(userId)} AND section_id = ${sql(sectionId)} AND deleted_at IS NULL ORDER BY display_order`);
  }

  async listBullets(userId, entityId) {
    return queryJson(this.databaseUrl, `SELECT ${bulletJson()} FROM resume_bullets WHERE user_id = ${sql(userId)} AND entity_id = ${sql(entityId)} AND deleted_at IS NULL ORDER BY display_order`);
  }

  async getRecord(table, json, id, userId) {
    const rows = await queryJson(this.databaseUrl, `SELECT ${json} FROM ${table} WHERE id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL LIMIT 1`);
    return rows[0] ?? null;
  }

  async updateRecord(table, json, id, userId, columns) {
    const updates = Object.entries({ ...columns, updated_at: new Date().toISOString() })
      .map(([key, value]) => `${key} = ${typeof value === "number" ? value : sql(value)}`)
      .join(", ");
    const rows = await queryJson(this.databaseUrl, `UPDATE ${table} SET ${updates} WHERE id = ${sql(id)} AND user_id = ${sql(userId)} AND deleted_at IS NULL RETURNING ${json}`);
    return rows[0] ?? null;
  }
}

export function createResumeEditorRepository(config, dependencies = {}) {
  if (config.authRepositoryDriver === "memory") {
    return new InMemoryResumeEditorRepository(dependencies);
  }
  return new PostgresResumeEditorRepository({ databaseUrl: config.databaseUrl });
}

function updateMapRecord(map, id, userId, changes) {
  const record = getActive(map, id, userId);
  if (!record) return null;
  const updated = { ...record, ...changes, updatedAt: new Date().toISOString() };
  map.set(id, updated);
  return updated;
}

function getActive(map, id, userId) {
  const record = map.get(id);
  if (!record || record.userId !== userId || record.deletedAt) return null;
  return record;
}

function sectionColumns(changes) {
  return mapColumns(changes, {
    sectionType: "section_type",
    title: "title",
    displayOrder: "display_order",
    visibility: "visibility",
    deletedAt: "deleted_at"
  });
}

function entityColumns(changes) {
  return mapColumns(changes, {
    entityType: "entity_type",
    title: "title",
    organization: "organization",
    location: "location",
    startDate: "start_date",
    endDate: "end_date",
    datePrecision: "date_precision",
    isCurrent: "is_current",
    url: "url",
    displayOrder: "display_order",
    visibility: "visibility",
    deletedAt: "deleted_at"
  });
}

function bulletColumns(changes) {
  return mapColumns(changes, {
    text: "text",
    normalizedText: "normalized_text",
    displayOrder: "display_order",
    visibility: "visibility",
    category: "category",
    actionVerb: "action_verb",
    deletedAt: "deleted_at"
  });
}

function mapColumns(changes, mapping) {
  return Object.fromEntries(Object.entries(changes)
    .filter(([key]) => mapping[key])
    .map(([key, value]) => [mapping[key], value]));
}

function sectionJson() {
  return `json_build_object('id', id, 'resumeId', resume_id, 'userId', user_id, 'sectionType', section_type, 'title', title, 'displayOrder', display_order, 'visibility', visibility, 'source', source, 'confidence', confidence, 'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at) AS value`;
}

function entityJson() {
  return `json_build_object('id', id, 'resumeId', resume_id, 'sectionId', section_id, 'userId', user_id, 'entityType', entity_type, 'title', title, 'organization', organization, 'location', location, 'startDate', start_date, 'endDate', end_date, 'datePrecision', date_precision, 'isCurrent', is_current, 'url', url, 'displayOrder', display_order, 'visibility', visibility, 'source', source, 'confidence', confidence, 'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at) AS value`;
}

function bulletJson() {
  return `json_build_object('id', id, 'resumeId', resume_id, 'sectionId', section_id, 'entityId', entity_id, 'userId', user_id, 'text', text, 'normalizedText', normalized_text, 'displayOrder', display_order, 'visibility', visibility, 'category', category, 'priority', priority, 'confidence', confidence, 'actionVerb', action_verb, 'source', source, 'parentBulletId', parent_bullet_id, 'metadata', metadata, 'truthConstraints', truth_constraints, 'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at) AS value`;
}

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function firstWord(value) {
  return String(value ?? "").trim().split(/\s+/)[0] || null;
}

function defaultTruthConstraints() {
  return {
    mayRewrite: true,
    mayReorder: true,
    mayHide: true,
    mayAddTechnology: false,
    mayAddMetric: false,
    mayInferSeniority: false
  };
}
