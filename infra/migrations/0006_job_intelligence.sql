CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  company TEXT,
  position TEXT,
  location TEXT,
  employment_type TEXT,
  seniority TEXT,
  salary JSONB,
  raw_text TEXT NOT NULL,
  raw_text_hash TEXT NOT NULL,
  source_url TEXT,
  parse_status TEXT NOT NULL,
  parse_confidence NUMERIC(4,3) NOT NULL,
  parsed_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS job_descriptions_user_id_idx
  ON job_descriptions (user_id);

CREATE INDEX IF NOT EXISTS job_descriptions_user_created_idx
  ON job_descriptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS job_descriptions_user_company_idx
  ON job_descriptions (user_id, company);

CREATE INDEX IF NOT EXISTS job_descriptions_user_position_idx
  ON job_descriptions (user_id, position);

CREATE INDEX IF NOT EXISTS job_descriptions_raw_text_hash_idx
  ON job_descriptions (raw_text_hash);

CREATE UNIQUE INDEX IF NOT EXISTS job_descriptions_user_raw_hash_uidx
  ON job_descriptions (user_id, raw_text_hash)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS job_requirements (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE RESTRICT,
  requirement_type TEXT NOT NULL,
  text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  importance TEXT NOT NULL,
  weight NUMERIC(5,2) NOT NULL,
  category TEXT NOT NULL,
  source_span JSONB,
  confidence NUMERIC(4,3) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS job_requirements_job_description_id_idx
  ON job_requirements (job_description_id);

CREATE INDEX IF NOT EXISTS job_requirements_user_normalized_idx
  ON job_requirements (user_id, normalized_text);

CREATE INDEX IF NOT EXISTS job_requirements_job_importance_idx
  ON job_requirements (job_description_id, importance);

CREATE INDEX IF NOT EXISTS job_requirements_type_normalized_idx
  ON job_requirements (requirement_type, normalized_text);

CREATE UNIQUE INDEX IF NOT EXISTS job_requirements_job_normalized_uidx
  ON job_requirements (job_description_id, normalized_text)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS job_keywords (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE RESTRICT,
  keyword TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  importance TEXT NOT NULL,
  weight NUMERIC(5,2) NOT NULL,
  source TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS job_keywords_job_description_id_idx
  ON job_keywords (job_description_id);

CREATE INDEX IF NOT EXISTS job_keywords_user_normalized_idx
  ON job_keywords (user_id, normalized_keyword);

CREATE UNIQUE INDEX IF NOT EXISTS job_keywords_job_normalized_uidx
  ON job_keywords (job_description_id, normalized_keyword)
  WHERE deleted_at IS NULL;
