# PRISM OGE Approvals App (React/Vite)

## IMPORTANT: CURRENT BACKEND/DATABASE IS TEMPORARY (PROTOTYPE FORMAT)

This repository currently uses a temporary backend/database structure for prototype flow validation and demo support.
The final envisioned production architecture (schema/API/authorization hardening) is planned as a future update.

This repository contains the **React + Vite** version of PRISM for outward mobility approvals.

It includes role-based screens for:
- Student
- OGE Office
- Program Chair
- Student Life
- Dean

## What Is In This Repo

- React app source code in `src/`
- Backend workflow/database scaffold in `server/`
- Routing setup in `src/App.jsx`
- Shared layouts in `src/layouts/`
- Reusable components in `src/components/`
- Role-specific pages in `src/screens/`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run locally:

```bash
npm run dev
```

If you are using API-integrated screens, run backend API in another terminal:

```bash
npm run server:dev
```

3. Open in browser:

`http://localhost:5173/`

Note: Vite proxies `/api/*` requests to `http://localhost:8787` in development.

## Build For Production

```bash
npm run build
```

The production output is generated in `dist/` (not committed to git).

## Backend Scaffold (V1)

The project now includes a minimal backend-oriented structure for PRISM workflow and database implementation planning.

- `server/config/`:
	- `workflow.js` stage order and decision constants
	- `roles.js` role constants and reject rules
	- `visibility.js` visibility scopes
- `server/db/`:
	- `tableCatalog.js` canonical table names
	- `schemaPlan.js` table-to-fields planning map
- `server/repositories/`:
	- SQLite-backed repository classes
- `server/services/`:
	- `workflowService.js` stage transition logic
	- `accessService.js` visibility and role checks
	- `applicationService.js`, `reviewService.js` orchestration
- `server/index.js`:
	- composition root to wire repos and services

Initialize local DB schema (with demo seed):

```bash
npm run db:init
```

Run a quick backend smoke test:

```bash
npm run smoke:server
```

Expected output:

`server-smoke-ok`

## Main Routes

- `/` Home/role selector
- `/student` Student dashboard
- `/student/applications` Student application list
- `/student/application/:id` Student application form/details
- `/student/messages` Student messages
- `/oge` OGE master dashboard
- `/oge/application/:id` OGE application review
- `/program-chair` Program Chair task inbox
- `/program-chair/:id` Program Chair review
- `/student-life` Student Life task inbox
- `/student-life/:id` Student Life review
- `/dean/:id` Dean final approval

## Notes

- This repo contains both frontend (React/Vite) and backend (Express + SQLite) components.
- Core submit/review/withdraw API flows are implemented; additional endpoints can be incrementally added.
- Current backend/database structure is a temporary working implementation for prototype flow validation and demo support.
- The final envisioned production architecture (schema/API/authorization hardening) is planned as a future update.

## Review Prep

- `docs/CODE_REVIEW_READINESS.md` contains the viva-ready summary for product pitch, user journeys, databases, APIs, and implementation status.
