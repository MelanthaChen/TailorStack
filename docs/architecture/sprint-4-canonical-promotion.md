# Sprint 4 Canonical Resume Promotion

Sprint 4 implements the only approved path from parsed draft to canonical resume truth: explicit user approval.

## Backend Boundary

- `DraftReviewController` exposes review, approve, and reject endpoints.
- `DraftPromotionService` owns business rules.
- `validateDraftForPromotion` checks draft integrity before promotion.
- `PromotionRepository` owns transactional version, diff, resume activation, and audit persistence.
- `CanonicalResumeResolver` resolves the promoted canonical resume view.

## Implemented APIs

- `GET /v1/resumes/:resumeId/draft-review`
- `POST /v1/resumes/:resumeId/promote`
- `POST /v1/resumes/:resumeId/reject-draft`

## Database Scope

Migration `0005_canonical_resume_promotion.sql` creates only:

- `resume_versions`
- `resume_diffs`
- `audit_events`

No JD, ATS, matching, rewrite, or application tables are introduced.

## Promotion Flow

```text
Parsed draft
  -> User review
  -> Approve
  -> Create initial master resume version
  -> Create empty diff
  -> Mark resume active
  -> Write audit event
```

## Frontend Scope

- Draft review page
- Confidence indicators
- Missing information warnings
- Approve, Reject, Re-run parser, Cancel

No editing, JD, ATS, matching, rewrite, or application tracking UI is included.
