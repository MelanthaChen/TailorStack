# Sprint 1 Authentication

Sprint 1 implements authentication and the protected application shell only.

## Backend Boundary

- Routes are defined in `apps/api/src/app.js`.
- Routes call `AuthController`.
- `AuthController` calls `AuthService`.
- `AuthService` calls `AuthRepository`.
- Middleware attaches the current user from the signed session cookie.

## Implemented APIs

- `POST /v1/auth/signup`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`
- `GET /v1/protected/status`

## Database Scope

Migration `0002_authentication.sql` creates only authentication-related tables:

- `users`
- `auth_identities`
- `user_sessions`

No product tables are introduced in this sprint.

## Frontend Scope

- Login page
- Signup page
- Protected dashboard shell
- Logout flow
- Unauthorized redirect
- Session check on refresh

No resume, JD, matching, ATS, rendering, or application tracking UI is included.
