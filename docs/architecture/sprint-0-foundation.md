# Sprint 0 Foundation

Sprint 0 creates the engineering substrate only. It intentionally does not include authentication, resume import, parsing, matching, ATS, rendering, or application tracking.

## Boundaries

- `apps/web`: frontend shell.
- `apps/api`: backend API shell and health endpoint.
- `packages/config`: environment configuration.
- `packages/logger`: structured JSON logging.
- `packages/schemas`: shared constants and future contract home.
- `packages/database`: database configuration boundary.
- `packages/queue`: queue abstraction boundary.
- `packages/object-storage`: object storage abstraction boundary.
- `workers/*`: worker package placeholders without product behavior.

## Local Infrastructure

Docker Compose provides PostgreSQL, Redis, and MinIO for development. Product tables are intentionally not created in Sprint 0.
