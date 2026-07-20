CREATE TABLE IF NOT EXISTS version_snapshots (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  version_id UUID NOT NULL REFERENCES resume_versions(id) ON DELETE RESTRICT,
  patch_set_id UUID NOT NULL REFERENCES optimization_patch_sets(id) ON DELETE RESTRICT,
  snapshot_hash TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS version_snapshots_version_id_uidx
  ON version_snapshots (version_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS version_snapshots_resume_id_idx
  ON version_snapshots (resume_id);

CREATE TABLE IF NOT EXISTS render_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  version_id UUID NOT NULL REFERENCES resume_versions(id) ON DELETE RESTRICT,
  format TEXT NOT NULL,
  status TEXT NOT NULL,
  result_rendered_resume_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS render_jobs_version_id_idx
  ON render_jobs (version_id);

CREATE INDEX IF NOT EXISTS render_jobs_user_status_idx
  ON render_jobs (user_id, status);

CREATE TABLE IF NOT EXISTS rendered_resumes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  version_id UUID NOT NULL REFERENCES resume_versions(id) ON DELETE RESTRICT,
  render_job_id UUID NOT NULL REFERENCES render_jobs(id) ON DELETE RESTRICT,
  format TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS rendered_resumes_version_id_idx
  ON rendered_resumes (version_id);

CREATE INDEX IF NOT EXISTS rendered_resumes_user_format_idx
  ON rendered_resumes (user_id, format);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'render_jobs_result_rendered_resume_id_fkey'
  ) THEN
    ALTER TABLE render_jobs
      ADD CONSTRAINT render_jobs_result_rendered_resume_id_fkey
      FOREIGN KEY (result_rendered_resume_id) REFERENCES rendered_resumes(id) ON DELETE RESTRICT;
  END IF;
END $$;
