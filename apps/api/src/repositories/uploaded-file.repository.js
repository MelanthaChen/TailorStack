import { queryJson, sql } from "./sql-utils.js";

export class InMemoryUploadedFileRepository {
  constructor() {
    this.files = new Map();
  }

  async createUploadedFile(input) {
    const now = new Date().toISOString();
    const file = {
      id: crypto.randomUUID(),
      userId: input.userId,
      fileType: input.fileType,
      originalFilename: input.originalFilename,
      contentType: input.contentType,
      byteSize: input.byteSize,
      objectStorageKey: input.objectStorageKey,
      checksumSha256: input.checksumSha256,
      virusScanStatus: input.virusScanStatus ?? null,
      status: input.status ?? "uploaded",
      metadata: input.metadata ?? {},
      createdAt: now,
      deletedAt: null
    };
    this.files.set(file.id, file);
    return file;
  }

  async findByChecksumForUser(userId, checksumSha256) {
    return [...this.files.values()].find((file) =>
      file.userId === userId &&
      file.checksumSha256 === checksumSha256 &&
      !file.deletedAt
    ) ?? null;
  }

  async findById(id) {
    return this.files.get(id) ?? null;
  }
}

export class PostgresUploadedFileRepository {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
  }

  async createUploadedFile(input) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const rows = await queryJson(this.databaseUrl, `
      INSERT INTO uploaded_files (
        id, user_id, file_type, original_filename, content_type, byte_size,
        object_storage_key, checksum_sha256, virus_scan_status, status,
        metadata, created_at
      )
      VALUES (
        ${sql(id)}, ${sql(input.userId)}, ${sql(input.fileType)}, ${sql(input.originalFilename)},
        ${sql(input.contentType)}, ${input.byteSize}, ${sql(input.objectStorageKey)},
        ${sql(input.checksumSha256)}, ${sql(input.virusScanStatus ?? null)},
        ${sql(input.status ?? "uploaded")}, ${sql(input.metadata ?? {})}::jsonb, ${sql(now)}
      )
      RETURNING ${uploadedFileJson()}
    `);
    return rows[0];
  }

  async findByChecksumForUser(userId, checksumSha256) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${uploadedFileJson()}
      FROM uploaded_files
      WHERE user_id = ${sql(userId)}
        AND checksum_sha256 = ${sql(checksumSha256)}
        AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findById(id) {
    const rows = await queryJson(this.databaseUrl, `
      SELECT ${uploadedFileJson()}
      FROM uploaded_files
      WHERE id = ${sql(id)}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }
}

export function createUploadedFileRepository(config) {
  if (config.authRepositoryDriver === "memory") {
    return new InMemoryUploadedFileRepository();
  }
  return new PostgresUploadedFileRepository({ databaseUrl: config.databaseUrl });
}

function uploadedFileJson() {
  return `json_build_object(
    'id', id,
    'userId', user_id,
    'fileType', file_type,
    'originalFilename', original_filename,
    'contentType', content_type,
    'byteSize', byte_size,
    'objectStorageKey', object_storage_key,
    'checksumSha256', checksum_sha256,
    'virusScanStatus', virus_scan_status,
    'status', status,
    'metadata', metadata,
    'createdAt', created_at,
    'deletedAt', deleted_at
  ) AS value`;
}
