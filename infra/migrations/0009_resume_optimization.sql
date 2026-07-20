CREATE TABLE IF NOT EXISTS optimization_patch_sets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  readiness_report_id UUID NOT NULL REFERENCES application_readiness_reports(id) ON DELETE RESTRICT,
  match_report_id UUID NOT NULL REFERENCES match_reports(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  patch_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS optimization_patch_sets_user_created_idx
  ON optimization_patch_sets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS optimization_patch_sets_readiness_report_id_idx
  ON optimization_patch_sets (readiness_report_id);

CREATE TABLE IF NOT EXISTS optimization_patches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  patch_set_id UUID NOT NULL REFERENCES optimization_patch_sets(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL,
  target JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  before_value JSONB,
  after_value JSONB,
  display_order INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS optimization_patches_patch_set_id_idx
  ON optimization_patches (patch_set_id);

CREATE INDEX IF NOT EXISTS optimization_patches_user_operation_idx
  ON optimization_patches (user_id, operation);

CREATE TABLE IF NOT EXISTS patch_review_states (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  patch_set_id UUID NOT NULL REFERENCES optimization_patch_sets(id) ON DELETE RESTRICT,
  patch_id UUID NOT NULL REFERENCES optimization_patches(id) ON DELETE RESTRICT,
  state TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS patch_review_states_patch_id_uidx
  ON patch_review_states (patch_id);

CREATE INDEX IF NOT EXISTS patch_review_states_patch_set_id_idx
  ON patch_review_states (patch_set_id);

CREATE INDEX IF NOT EXISTS patch_review_states_user_state_idx
  ON patch_review_states (user_id, state);
