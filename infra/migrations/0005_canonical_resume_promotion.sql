CREATE TABLE IF NOT EXISTS resume_versions (
  id UUID PRIMARY KEY,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  parent_version_id UUID REFERENCES resume_versions(id) ON DELETE RESTRICT,
  version_type TEXT NOT NULL,
  name TEXT NOT NULL,
  target_company TEXT,
  target_role TEXT,
  job_description_id UUID,
  status TEXT NOT NULL,
  diff_id UUID,
  resolved_schema_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS resume_versions_resume_id_idx
  ON resume_versions (resume_id);

CREATE INDEX IF NOT EXISTS resume_versions_user_id_idx
  ON resume_versions (user_id);

CREATE INDEX IF NOT EXISTS resume_versions_parent_version_id_idx
  ON resume_versions (parent_version_id);

CREATE INDEX IF NOT EXISTS resume_versions_user_status_idx
  ON resume_versions (user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS resume_versions_user_resume_name_uidx
  ON resume_versions (user_id, resume_id, name)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS resume_diffs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  base_version_id UUID NOT NULL REFERENCES resume_versions(id) ON DELETE RESTRICT,
  source_match_result_id UUID,
  operation_count INTEGER NOT NULL,
  operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_version INTEGER NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS resume_diffs_resume_id_idx
  ON resume_diffs (resume_id);

CREATE INDEX IF NOT EXISTS resume_diffs_base_version_id_idx
  ON resume_diffs (base_version_id);

CREATE INDEX IF NOT EXISTS resume_diffs_user_id_idx
  ON resume_diffs (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resume_versions_diff_id_fkey'
  ) THEN
    ALTER TABLE resume_versions
      ADD CONSTRAINT resume_versions_diff_id_fkey
      FOREIGN KEY (diff_id) REFERENCES resume_diffs(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resumes_canonical_version_id_fkey'
  ) THEN
    ALTER TABLE resumes
      ADD CONSTRAINT resumes_canonical_version_id_fkey
      FOREIGN KEY (canonical_version_id) REFERENCES resume_versions(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  request_id TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_user_created_idx
  ON audit_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS audit_events_resource_idx
  ON audit_events (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS audit_events_event_type_idx
  ON audit_events (event_type);

CREATE INDEX IF NOT EXISTS audit_events_request_id_idx
  ON audit_events (request_id);
