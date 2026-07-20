# Sprint 2 Resume Upload Pipeline

Sprint 2 implements authenticated master resume PDF upload only. It does not parse uploaded files.

## Backend Boundary

- `ResumeUploadController` handles HTTP request/response only.
- `ResumeUploadService` validates upload workflow and coordinates repositories/storage/queue.
- Repositories own persistence for `uploaded_files`, `resumes`, and `async_jobs`.
- Object bytes are written only through the shared object storage abstraction.
- Parse job creation is a durable queued job stub with `job_type = resume_parse`.

## Implemented APIs

- `POST /v1/resumes/uploads`
- `GET /v1/resumes`
- `GET /v1/resumes/:resumeId/upload-status`

All endpoints require authentication.

## Database Scope

Migration `0003_resume_upload_pipeline.sql` creates only:

- `uploaded_files`
- `resumes`
- `async_jobs`

No resume sections, entities, bullets, embeddings, ATS, JD, versions, or parser output tables are introduced.

## Frontend Scope

- Basic upload page
- Upload progress/status states
- Upload success/failure
- Retry upload
- Basic uploaded resume list

No resume review, editing, parser output, versions, ATS, matching, or application tracking UI is included.
