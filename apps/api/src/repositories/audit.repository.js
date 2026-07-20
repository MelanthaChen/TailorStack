import { queryJson, sql } from "./sql-utils.js";

export class InMemoryAuditRepository {
  constructor({ promotionRepository } = {}) {
    this.auditEvents = promotionRepository?.auditEvents ?? new Map();
  }

  async createAuditEvent(input) {
    const event = {
      id: crypto.randomUUID(),
      userId: input.userId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      requestId: input.requestId ?? null,
      ipHash: null,
      userAgentHash: null,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString()
    };
    this.auditEvents.set(event.id, event);
    return event;
  }
}

export class PostgresAuditRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createAuditEvent(input) {
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO audit_events (
        id, user_id, actor_user_id, event_type, resource_type, resource_id,
        request_id, metadata, created_at
      )
      VALUES (
        ${sql(crypto.randomUUID())}, ${sql(input.userId)}, ${sql(input.actorUserId)},
        ${sql(input.eventType)}, ${sql(input.resourceType)}, ${sql(input.resourceId ?? null)},
        ${sql(input.requestId ?? null)}, ${sql(input.metadata ?? {})}::jsonb, ${sql(new Date().toISOString())}
      )
      RETURNING json_build_object(
        'id', id, 'userId', user_id, 'actorUserId', actor_user_id,
        'eventType', event_type, 'resourceType', resource_type, 'resourceId', resource_id,
        'requestId', request_id, 'metadata', metadata, 'createdAt', created_at
      ) AS value
    `);
    return rows[0];
  }
}

export function createAuditRepository(config, dependencies = {}) {
  if (config.authRepositoryDriver === "memory") {
    return new InMemoryAuditRepository(dependencies);
  }
  return new PostgresAuditRepository({ databaseUrl: config.databaseUrl });
}
