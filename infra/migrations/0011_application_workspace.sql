CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  company TEXT NOT NULL,
  position TEXT,
  job_description_id UUID REFERENCES job_descriptions(id) ON DELETE RESTRICT,
  resume_version_id UUID NOT NULL REFERENCES resume_versions(id) ON DELETE RESTRICT,
  match_report_id UUID REFERENCES match_reports(id) ON DELETE RESTRICT,
  readiness_report_id UUID REFERENCES application_readiness_reports(id) ON DELETE RESTRICT,
  optimization_patch_set_id UUID REFERENCES optimization_patch_sets(id) ON DELETE RESTRICT,
  rendered_resume_id UUID REFERENCES rendered_resumes(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS applications_user_status_idx
  ON applications (user_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS applications_user_updated_idx
  ON applications (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS applications_resume_version_id_idx
  ON applications (resume_version_id);

CREATE INDEX IF NOT EXISTS applications_job_description_id_idx
  ON applications (job_description_id);

CREATE TABLE IF NOT EXISTS application_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  from_status TEXT,
  to_status TEXT,
  artifact_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS application_events_application_created_idx
  ON application_events (application_id, created_at);

CREATE INDEX IF NOT EXISTS application_events_user_type_idx
  ON application_events (user_id, event_type);

CREATE TABLE IF NOT EXISTS application_notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS application_notes_application_created_idx
  ON application_notes (application_id, created_at DESC)
  WHERE deleted_at IS NULL;
