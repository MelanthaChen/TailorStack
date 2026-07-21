# TailorStack

TailorStack is a resume operating system for software engineers. The structured resume schema is the source of truth; PDFs, HTML, and JSON exports are generated artifacts.

## Architecture Overview

TailorStack is a Node.js monorepo with a browser frontend, HTTP API, shared packages, migrations, and worker-ready infrastructure.

- `apps/api`: HTTP API, controllers, services, repositories, middleware.
- `apps/web`: static application shell and local development server.
- `packages/config`: typed environment loading and startup validation.
- `packages/database`: PostgreSQL connection pool, query execution, transactions, health checks, retries, and shutdown.
- `packages/queue`: generic async job framework and repository-backed queue adapter.
- `packages/ai`: provider, prompt, validation, and pipeline boundaries.
- `packages/object-storage`: storage abstraction for uploaded and generated artifacts.
- `infra/migrations`: schema migrations.
- `tests`: unit, integration, and end-to-end coverage.

## Domain Responsibilities

- Authentication: users, sessions, protected routes, ownership checks.
- Resume intake: PDF upload, object storage, duplicate detection, parser jobs.
- Resume parser: PDF extraction, AI parser pipeline, structured draft persistence.
- Canonical resume: explicit promotion, editor CRUD, ordering, hide/show, audit events.
- Job intelligence: deterministic JD extraction plus AI normalization.
- Matching: deterministic evidence generation, skill matches, and gaps.
- Readiness: deterministic findings and recommendations.
- Optimization: reviewable patch sets only; no automatic canonical edits.
- Versioning: accepted patches create immutable versions, snapshots, diffs, and rendered artifacts.
- Application workspace: references immutable artifacts, status history, timeline, and notes.

## AI Pipeline

AI access lives under `packages/ai`. Business services never call model providers directly. AI may parse, normalize, explain, and propose wording, but deterministic services own matching, readiness decisions, patch validation, and artifact application.

## Matching Pipeline

Canonical Resume + Normalized Job Model -> Normalizer -> Matcher -> Evidence Generator -> Gap Analyzer -> Match Report.

Every match has evidence. Every gap has a reason. The matcher is deterministic.

## Versioning Flow

Canonical Resume + Accepted Patch Set -> Conflict Detector -> Patch Applier -> Snapshot Generator -> Diff Generator -> Renderer.

Resume versions and snapshots are immutable. Applications only reference versions; they never modify them.

## Application Workspace

Applications persist one real job application. Each workspace references exactly one resume version and may link a job description, match report, readiness report, optimization patch set, and rendered resume. Timeline events and notes are append-only records of user activity.

## Database Schema Overview

Core schema areas:

- Auth: `users`, `auth_identities`, `user_sessions`
- Uploads: `uploaded_files`, `resumes`, `async_jobs`
- Resume schema: `resume_sections`, `resume_entities`, `resume_bullets`
- Versioning: `resume_versions`, `resume_diffs`, `version_snapshots`
- Job intelligence: `job_descriptions`, `job_requirements`, `job_keywords`
- Matching/readiness/optimization: `match_reports`, `match_evidence`, `skill_matches`, `skill_gaps`, `application_readiness_reports`, `readiness_findings`, `optimization_recommendations`, `optimization_patch_sets`, `optimization_patches`, `patch_review_states`
- Rendering: `render_jobs`, `rendered_resumes`
- Applications: `applications`, `application_events`, `application_notes`
- Audit: `audit_events`

## Local Development

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the full local stack:
   ```sh
   npm run dev
   ```

`npm run dev` starts Docker infrastructure, waits for PostgreSQL, then starts the API and Web app with prefixed logs:

```text
[infra] PostgreSQL ready
[api] Listening on :4000
[web] Web app listening on http://127.0.0.1:3000
```

Press `Ctrl+C` to stop API and Web. Docker infrastructure is left running for faster restarts.

Stop everything, including Docker infrastructure:

```sh
npm run stop
```

Optional individual commands are still available:

```sh
npm run dev:infra
npm run migrate
npm run dev:api
npm run dev:web
```

Copy `.env.example` to `.env` only when overriding local defaults:

```sh
cp .env.example .env
```

Run migrations manually when schema changes are added:

```sh
npm run migrate
```

## Testing

```sh
npm run check
npm test
```

The test suite covers unit, integration, and end-to-end flows from upload through application workspace creation.

## Deployment

Production startup validates required configuration and rejects weak secrets. Set at minimum:

- `APP_ENV=production`
- `NODE_ENV=production`
- `DATABASE_URL`
- `SESSION_SECRET`
- `WEB_ORIGIN`
- object storage settings

The API handles structured request logging, security headers, content-type validation, body limits, rate limiting, graceful shutdown, and database pool shutdown.

## Troubleshooting

- Health check: `GET /healthz`
- Migration failures: verify `DATABASE_URL`, database reachability, and migration ordering.
- Auth failures: verify `SESSION_SECRET`, cookie settings, and `WEB_ORIGIN`.
- Upload failures: verify `MAX_UPLOAD_BYTES` and object storage path or credentials.
- Rate limit failures: tune `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`.
