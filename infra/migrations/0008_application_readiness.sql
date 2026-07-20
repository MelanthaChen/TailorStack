CREATE TABLE IF NOT EXISTS application_readiness_reports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE RESTRICT,
  match_report_id UUID NOT NULL REFERENCES match_reports(id) ON DELETE RESTRICT,
  readiness_score NUMERIC(5,2) NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS application_readiness_reports_user_created_idx
  ON application_readiness_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS application_readiness_reports_match_report_id_idx
  ON application_readiness_reports (match_report_id);

CREATE INDEX IF NOT EXISTS application_readiness_reports_resume_id_idx
  ON application_readiness_reports (resume_id);

CREATE TABLE IF NOT EXISTS readiness_findings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  readiness_report_id UUID NOT NULL REFERENCES application_readiness_reports(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS readiness_findings_report_idx
  ON readiness_findings (readiness_report_id);

CREATE INDEX IF NOT EXISTS readiness_findings_user_category_idx
  ON readiness_findings (user_id, category);

CREATE INDEX IF NOT EXISTS readiness_findings_severity_idx
  ON readiness_findings (severity);

CREATE TABLE IF NOT EXISTS optimization_recommendations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  readiness_report_id UUID NOT NULL REFERENCES application_readiness_reports(id) ON DELETE RESTRICT,
  finding_id UUID REFERENCES readiness_findings(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  text TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4,3) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS optimization_recommendations_report_idx
  ON optimization_recommendations (readiness_report_id);

CREATE INDEX IF NOT EXISTS optimization_recommendations_finding_id_idx
  ON optimization_recommendations (finding_id);

CREATE INDEX IF NOT EXISTS optimization_recommendations_priority_idx
  ON optimization_recommendations (priority);
