CREATE TABLE IF NOT EXISTS resume_sections (
  id UUID PRIMARY KEY,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  section_type TEXT NOT NULL,
  title TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence NUMERIC(4,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS resume_sections_resume_id_idx
  ON resume_sections (resume_id);

CREATE INDEX IF NOT EXISTS resume_sections_resume_order_idx
  ON resume_sections (resume_id, display_order);

CREATE INDEX IF NOT EXISTS resume_sections_user_type_idx
  ON resume_sections (user_id, section_type);

CREATE TABLE IF NOT EXISTS resume_entities (
  id UUID PRIMARY KEY,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES resume_sections(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  title TEXT,
  organization TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  date_precision TEXT,
  is_current BOOLEAN NOT NULL,
  url TEXT,
  display_order INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence NUMERIC(4,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS resume_entities_resume_id_idx
  ON resume_entities (resume_id);

CREATE INDEX IF NOT EXISTS resume_entities_section_id_idx
  ON resume_entities (section_id);

CREATE INDEX IF NOT EXISTS resume_entities_user_type_idx
  ON resume_entities (user_id, entity_type);

CREATE INDEX IF NOT EXISTS resume_entities_resume_section_order_idx
  ON resume_entities (resume_id, section_id, display_order);

CREATE TABLE IF NOT EXISTS resume_bullets (
  id UUID PRIMARY KEY,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES resume_sections(id) ON DELETE RESTRICT,
  entity_id UUID NOT NULL REFERENCES resume_entities(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  text TEXT NOT NULL,
  normalized_text TEXT,
  display_order INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  category TEXT,
  priority NUMERIC(4,3),
  confidence NUMERIC(4,3),
  action_verb TEXT,
  source TEXT NOT NULL,
  parent_bullet_id UUID REFERENCES resume_bullets(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  truth_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS resume_bullets_resume_id_idx
  ON resume_bullets (resume_id);

CREATE INDEX IF NOT EXISTS resume_bullets_entity_id_idx
  ON resume_bullets (entity_id);

CREATE INDEX IF NOT EXISTS resume_bullets_resume_entity_order_idx
  ON resume_bullets (resume_id, entity_id, display_order);

CREATE INDEX IF NOT EXISTS resume_bullets_user_category_idx
  ON resume_bullets (user_id, category);
