# Sprint 5 Canonical Resume Management

Sprint 5 introduces editing of active canonical master resume data only.

## Backend Boundary

- `ResumeEditorController` exposes thin CRUD/reorder/visibility endpoints.
- `ResumeEditorService` owns business rules and validation.
- `ResumeEditorRepository` owns persistence to existing resume section/entity/bullet tables.
- `AuditRepository` writes an `audit_events` row for every edit.

## Implemented APIs

- `GET /v1/resumes/:resumeId/canonical`
- `POST /v1/resumes/:resumeId/canonical`
- `POST /v1/resumes/:resumeId/sections/reorder`
- `PATCH /v1/sections/:sectionId`
- `DELETE /v1/sections/:sectionId`
- `POST /v1/sections/:sectionId/visibility`
- `POST /v1/sections/:sectionId/entities`
- `POST /v1/sections/:sectionId/entities/reorder`
- `PATCH /v1/entities/:entityId`
- `DELETE /v1/entities/:entityId`
- `POST /v1/entities/:entityId/bullets`
- `POST /v1/entities/:entityId/bullets/reorder`
- `PATCH /v1/bullets/:bulletId`
- `DELETE /v1/bullets/:bulletId`
- `POST /v1/bullets/:bulletId/visibility`

## Database Scope

No new database tables are introduced. Sprint 5 uses:

- `resume_sections`
- `resume_entities`
- `resume_bullets`
- `audit_events`

## Frontend Scope

- Canonical resume editor
- Edit section title/type
- Add/delete section
- Add/delete/edit entity
- Add/delete/edit bullet
- Hide/show section and bullet
- Native drag-and-drop reorder for sections, entities, and bullets

No JD, matching, ATS, AI rewrite, rendering, or application tracking UI is included.
