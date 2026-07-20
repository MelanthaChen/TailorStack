import { queryJson, sql } from "./sql-utils.js";

export class InMemoryResumeParserRepository {
  constructor() {
    this.sections = new Map();
    this.entities = new Map();
    this.bullets = new Map();
  }

  async replaceParsedDraft({ userId, resumeId, sections }) {
    for (const [id, section] of [...this.sections]) {
      if (section.resumeId === resumeId && section.userId === userId) this.sections.delete(id);
    }
    for (const [id, entity] of [...this.entities]) {
      if (entity.resumeId === resumeId && entity.userId === userId) this.entities.delete(id);
    }
    for (const [id, bullet] of [...this.bullets]) {
      if (bullet.resumeId === resumeId && bullet.userId === userId) this.bullets.delete(id);
    }

    const now = new Date().toISOString();
    for (const [sectionIndex, sectionInput] of sections.entries()) {
      const section = {
        id: crypto.randomUUID(),
        resumeId,
        userId,
        sectionType: sectionInput.sectionType,
        title: sectionInput.title,
        displayOrder: sectionIndex,
        visibility: "visible",
        source: "parsed",
        confidence: sectionInput.confidence,
        metadata: sectionInput.metadata ?? {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };
      this.sections.set(section.id, section);

      for (const [entityIndex, entityInput] of sectionInput.entities.entries()) {
        const entity = {
          id: crypto.randomUUID(),
          resumeId,
          sectionId: section.id,
          userId,
          entityType: entityInput.entityType,
          title: entityInput.title ?? null,
          organization: entityInput.organization ?? null,
          location: entityInput.location ?? null,
          startDate: entityInput.startDate ?? null,
          endDate: entityInput.endDate ?? null,
          datePrecision: entityInput.datePrecision ?? null,
          isCurrent: entityInput.isCurrent ?? false,
          url: entityInput.url ?? null,
          displayOrder: entityIndex,
          visibility: "visible",
          source: "parsed",
          confidence: entityInput.confidence,
          metadata: entityInput.metadata ?? {},
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        this.entities.set(entity.id, entity);

        for (const [bulletIndex, bulletInput] of entityInput.bullets.entries()) {
          const bullet = {
            id: crypto.randomUUID(),
            resumeId,
            sectionId: section.id,
            entityId: entity.id,
            userId,
            text: bulletInput.text,
            normalizedText: normalize(bulletInput.text),
            displayOrder: bulletIndex,
            visibility: "visible",
            category: bulletInput.category ?? null,
            priority: bulletInput.priority ?? null,
            confidence: bulletInput.confidence,
            actionVerb: firstWord(bulletInput.text),
            source: "parsed",
            parentBulletId: null,
            metadata: bulletInput.metadata ?? {},
            truthConstraints: bulletInput.truthConstraints ?? defaultTruthConstraints(),
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          };
          this.bullets.set(bullet.id, bullet);
        }
      }
    }
    return this.getParsedDraft(userId, resumeId);
  }

  async getParsedDraft(userId, resumeId) {
    const sections = [...this.sections.values()]
      .filter((section) => section.userId === userId && section.resumeId === resumeId && !section.deletedAt)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((section) => ({
        ...section,
        entities: [...this.entities.values()]
          .filter((entity) => entity.sectionId === section.id && !entity.deletedAt)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((entity) => ({
            ...entity,
            bullets: [...this.bullets.values()]
              .filter((bullet) => bullet.entityId === entity.id && !bullet.deletedAt)
              .sort((a, b) => a.displayOrder - b.displayOrder)
          }))
      }));
    return sections;
  }
}

export class PostgresResumeParserRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async replaceParsedDraft({ userId, resumeId, sections }) {
    await queryJson(this.databaseUrl, `
      UPDATE resume_bullets SET deleted_at = now(), updated_at = now()
      WHERE user_id = ${sql(userId)} AND resume_id = ${sql(resumeId)} AND deleted_at IS NULL
      RETURNING json_build_object('ok', true) AS value
    `);
    await queryJson(this.databaseUrl, `
      UPDATE resume_entities SET deleted_at = now(), updated_at = now()
      WHERE user_id = ${sql(userId)} AND resume_id = ${sql(resumeId)} AND deleted_at IS NULL
      RETURNING json_build_object('ok', true) AS value
    `);
    await queryJson(this.databaseUrl, `
      UPDATE resume_sections SET deleted_at = now(), updated_at = now()
      WHERE user_id = ${sql(userId)} AND resume_id = ${sql(resumeId)} AND deleted_at IS NULL
      RETURNING json_build_object('ok', true) AS value
    `);

    const now = new Date().toISOString();
    for (const [sectionIndex, sectionInput] of sections.entries()) {
      const sectionId = crypto.randomUUID();
      await queryJson(this.databaseUrl, `
        INSERT INTO resume_sections (
          id, resume_id, user_id, section_type, title, display_order, visibility,
          source, confidence, metadata, created_at, updated_at
        )
        VALUES (
          ${sql(sectionId)}, ${sql(resumeId)}, ${sql(userId)}, ${sql(sectionInput.sectionType)},
          ${sql(sectionInput.title)}, ${sectionIndex}, 'visible', 'parsed',
          ${sectionInput.confidence}, ${sql(sectionInput.metadata ?? {})}::jsonb,
          ${sql(now)}, ${sql(now)}
        )
        RETURNING json_build_object('id', id) AS value
      `);

      for (const [entityIndex, entityInput] of sectionInput.entities.entries()) {
        const entityId = crypto.randomUUID();
        await queryJson(this.databaseUrl, `
          INSERT INTO resume_entities (
            id, resume_id, section_id, user_id, entity_type, title, organization,
            location, start_date, end_date, date_precision, is_current, url,
            display_order, visibility, source, confidence, metadata, created_at, updated_at
          )
          VALUES (
            ${sql(entityId)}, ${sql(resumeId)}, ${sql(sectionId)}, ${sql(userId)},
            ${sql(entityInput.entityType)}, ${sql(entityInput.title ?? null)},
            ${sql(entityInput.organization ?? null)}, ${sql(entityInput.location ?? null)},
            ${sql(entityInput.startDate ?? null)}, ${sql(entityInput.endDate ?? null)},
            ${sql(entityInput.datePrecision ?? null)}, ${entityInput.isCurrent ? "true" : "false"},
            ${sql(entityInput.url ?? null)}, ${entityIndex}, 'visible', 'parsed',
            ${entityInput.confidence}, ${sql(entityInput.metadata ?? {})}::jsonb,
            ${sql(now)}, ${sql(now)}
          )
          RETURNING json_build_object('id', id) AS value
        `);

        for (const [bulletIndex, bulletInput] of entityInput.bullets.entries()) {
          await queryJson(this.databaseUrl, `
            INSERT INTO resume_bullets (
              id, resume_id, section_id, entity_id, user_id, text, normalized_text,
              display_order, visibility, category, priority, confidence, action_verb,
              source, metadata, truth_constraints, created_at, updated_at
            )
            VALUES (
              ${sql(crypto.randomUUID())}, ${sql(resumeId)}, ${sql(sectionId)}, ${sql(entityId)},
              ${sql(userId)}, ${sql(bulletInput.text)}, ${sql(normalize(bulletInput.text))},
              ${bulletIndex}, 'visible', ${sql(bulletInput.category ?? null)},
              ${bulletInput.priority ?? "NULL"}, ${bulletInput.confidence},
              ${sql(firstWord(bulletInput.text))}, 'parsed',
              ${sql(bulletInput.metadata ?? {})}::jsonb,
              ${sql(bulletInput.truthConstraints ?? defaultTruthConstraints())}::jsonb,
              ${sql(now)}, ${sql(now)}
            )
            RETURNING json_build_object('id', id) AS value
          `);
        }
      }
    }
    return this.getParsedDraft(userId, resumeId);
  }

  async getParsedDraft(userId, resumeId) {
    const sections = await queryJson(this.databaseUrl, `
      SELECT ${sectionJson()}
      FROM resume_sections
      WHERE user_id = ${sql(userId)} AND resume_id = ${sql(resumeId)} AND deleted_at IS NULL
      ORDER BY display_order
    `);
    for (const section of sections) {
      section.entities = await queryJson(this.databaseUrl, `
        SELECT ${entityJson()}
        FROM resume_entities
        WHERE section_id = ${sql(section.id)} AND deleted_at IS NULL
        ORDER BY display_order
      `);
      for (const entity of section.entities) {
        entity.bullets = await queryJson(this.databaseUrl, `
          SELECT ${bulletJson()}
          FROM resume_bullets
          WHERE entity_id = ${sql(entity.id)} AND deleted_at IS NULL
          ORDER BY display_order
        `);
      }
    }
    return sections;
  }
}

export function createResumeParserRepository(config) {
  if (config.authRepositoryDriver === "memory") {
    return new InMemoryResumeParserRepository();
  }
  return new PostgresResumeParserRepository({ databaseUrl: config.databaseUrl });
}

function sectionJson() {
  return `json_build_object(
    'id', id, 'resumeId', resume_id, 'userId', user_id, 'sectionType', section_type,
    'title', title, 'displayOrder', display_order, 'visibility', visibility,
    'source', source, 'confidence', confidence, 'metadata', metadata,
    'createdAt', created_at, 'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}

function entityJson() {
  return `json_build_object(
    'id', id, 'resumeId', resume_id, 'sectionId', section_id, 'userId', user_id,
    'entityType', entity_type, 'title', title, 'organization', organization,
    'location', location, 'startDate', start_date, 'endDate', end_date,
    'datePrecision', date_precision, 'isCurrent', is_current, 'url', url,
    'displayOrder', display_order, 'visibility', visibility, 'source', source,
    'confidence', confidence, 'metadata', metadata, 'createdAt', created_at,
    'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
}

function bulletJson() {
  return `json_build_object(
    'id', id, 'resumeId', resume_id, 'sectionId', section_id, 'entityId', entity_id,
    'userId', user_id, 'text', text, 'normalizedText', normalized_text,
    'displayOrder', display_order, 'visibility', visibility, 'category', category,
    'priority', priority, 'confidence', confidence, 'actionVerb', action_verb,
    'source', source, 'parentBulletId', parent_bullet_id, 'metadata', metadata,
    'truthConstraints', truth_constraints, 'createdAt', created_at,
    'updatedAt', updated_at, 'deletedAt', deleted_at
  ) AS value`;
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
