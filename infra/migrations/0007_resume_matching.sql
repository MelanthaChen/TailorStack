CREATE TABLE IF NOT EXISTS match_reports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE RESTRICT,
  overall_score NUMERIC(5,2) NOT NULL,
  category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS match_reports_user_created_idx
  ON match_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS match_reports_resume_id_idx
  ON match_reports (resume_id);

CREATE INDEX IF NOT EXISTS match_reports_job_description_id_idx
  ON match_reports (job_description_id);

CREATE TABLE IF NOT EXISTS match_evidence (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  match_report_id UUID NOT NULL REFERENCES match_reports(id) ON DELETE RESTRICT,
  job_requirement_id UUID NOT NULL REFERENCES job_requirements(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  matched_by TEXT NOT NULL,
  section_id UUID REFERENCES resume_sections(id) ON DELETE RESTRICT,
  entity_id UUID REFERENCES resume_entities(id) ON DELETE RESTRICT,
  bullet_id UUID REFERENCES resume_bullets(id) ON DELETE RESTRICT,
  evidence_text TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS match_evidence_report_idx
  ON match_evidence (match_report_id);

CREATE INDEX IF NOT EXISTS match_evidence_requirement_idx
  ON match_evidence (job_requirement_id);

CREATE INDEX IF NOT EXISTS match_evidence_bullet_idx
  ON match_evidence (bullet_id);

CREATE TABLE IF NOT EXISTS skill_matches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  match_report_id UUID NOT NULL REFERENCES match_reports(id) ON DELETE RESTRICT,
  evidence_id UUID REFERENCES match_evidence(id) ON DELETE RESTRICT,
  skill TEXT NOT NULL,
  normalized_skill TEXT NOT NULL,
  category TEXT NOT NULL,
  match_type TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS skill_matches_report_idx
  ON skill_matches (match_report_id);

CREATE INDEX IF NOT EXISTS skill_matches_user_skill_idx
  ON skill_matches (user_id, normalized_skill);

CREATE TABLE IF NOT EXISTS skill_gaps (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  match_report_id UUID NOT NULL REFERENCES match_reports(id) ON DELETE RESTRICT,
  skill TEXT NOT NULL,
  normalized_skill TEXT NOT NULL,
  gap_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  importance TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS skill_gaps_report_idx
  ON skill_gaps (match_report_id);

CREATE INDEX IF NOT EXISTS skill_gaps_user_skill_idx
  ON skill_gaps (user_id, normalized_skill);
