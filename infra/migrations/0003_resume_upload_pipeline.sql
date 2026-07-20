CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  object_storage_key TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  virus_scan_status TEXT,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS uploaded_files_user_id_idx
  ON uploaded_files (user_id);

CREATE INDEX IF NOT EXISTS uploaded_files_checksum_sha256_idx
  ON uploaded_files (checksum_sha256);

CREATE INDEX IF NOT EXISTS uploaded_files_user_status_idx
  ON uploaded_files (user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uploaded_files_user_checksum_active_uidx
  ON uploaded_files (user_id, checksum_sha256)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  resume_type TEXT NOT NULL,
  status TEXT NOT NULL,
  canonical_version_id UUID,
  source_file_id UUID REFERENCES uploaded_files(id) ON DELETE RESTRICT,
  locale TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS resumes_user_id_idx
  ON resumes (user_id);

CREATE INDEX IF NOT EXISTS resumes_user_status_idx
  ON resumes (user_id, status);

CREATE INDEX IF NOT EXISTS resumes_user_type_idx
  ON resumes (user_id, resume_type);

CREATE INDEX IF NOT EXISTS resumes_source_file_id_idx
  ON resumes (source_file_id);

CREATE TABLE IF NOT EXISTS async_jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT,
  priority INTEGER NOT NULL,
  payload_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_ref JSONB,
  error_code TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL,
  available_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS async_jobs_status_available_priority_idx
  ON async_jobs (status, available_at, priority);

CREATE INDEX IF NOT EXISTS async_jobs_user_created_idx
  ON async_jobs (user_id, created_at);

CREATE INDEX IF NOT EXISTS async_jobs_job_type_idx
  ON async_jobs (job_type);

CREATE UNIQUE INDEX IF NOT EXISTS async_jobs_idempotency_key_uidx
  ON async_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
