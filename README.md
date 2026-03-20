# PRISM Approvals Platform (Next.js + FastAPI)

This repository now runs with:
- `Next.js` for role-based frontend surfaces.
- `FastAPI` as the single backend for auth + all `/api/*` calls.
- `SQLite` (`server/db/prism.sqlite`) with normalized PRISM schema.

## Run locally

1. Install Node dependencies:

```bash
npm install
```

2. Install Python dependencies:

```bash
python3 -m pip install -r fastapi_app/requirements.txt
```

3. Start FastAPI backend:

```bash
npm run api:dev
```

4. In a second terminal, start Next.js frontend:

```bash
npm run dev
```

5. Open app at:

- Frontend: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/swagger` (proxied to FastAPI)
- OpenAPI JSON: `http://localhost:3000/openapi.json`

## Auth + Roles

Use any seeded Plaksha email from the login quick-list (loaded from DB), for example:
- `rohan@plaksha.edu.in` (Student)
- `oge@plaksha.edu.in` (OGE Admin)
- `dean@plaksha.edu.in` (Dean Academics)

## Key Notes

- FastAPI owns auth/session (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`).
- Next.js rewrites proxy all `/api/*` and `/swagger` traffic to FastAPI.
- Admin workflow configuration is opportunity-specific in `/admin/opportunities/new`.
- Messaging is intentionally marked as WIP; reviewer comments remain active.
