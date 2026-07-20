# Sprint 3 Resume Parser

Sprint 3 converts uploaded PDFs into structured resume drafts. The parsed output is not canonical, cannot be edited, and cannot be confirmed in this sprint.

## Backend Boundary

- `PdfExtractionService` extracts text and basic page/block/line metadata.
- `AiResumeParserService` owns the parser prompt/service boundary.
- `validateParserOutput` enforces strict structured output.
- `ResumeParserService` owns parse job execution and lifecycle.
- `ResumeParserRepository` persists draft sections, entities, and bullets.
- `ResumeParserController` exposes thin status/run/retry/preview endpoints.

## Worker

The resume parser worker executes `resume_parse` jobs by ID:

```sh
node workers/resume-parser/src/run-job.js <job-id>
```

Job lifecycle:

```text
queued -> running -> succeeded
queued -> running -> failed
failed -> queued
```

## Implemented APIs

- `GET /v1/resumes/:resumeId/parsed-draft`
- `POST /v1/parse-jobs/:jobId/run`
- `POST /v1/parse-jobs/:jobId/retry`

## Database Scope

Migration `0004_resume_parser_drafts.sql` creates only:

- `resume_sections`
- `resume_entities`
- `resume_bullets`

No resume versions, diffs, embeddings, ATS, JD, or application tables are introduced.

## Frontend Scope

- Parse status
- Parser running/success/failure states
- Read-only parsed draft preview
- Section/entity/bullet confidence display

No editing, confirmation, versions, ATS, matching, JD, or application UI is included.
