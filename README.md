# PRISM OGE Approvals App (React/Vite)

This repository contains the **React + Vite** version of PRISM for outward mobility approvals.

It includes role-based screens for:
- Student
- OGE Office
- Program Chair
- Student Life
- Dean

## What Is In This Repo

- React app source code in `src/`
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

3. Open in browser:

`http://localhost:5173/`

## Build For Production

```bash
npm run build
```

The production output is generated in `dist/` (not committed to git).

## Main Routes

- `/` Home/role selector
- `/student` Student dashboard
- `/student/applications` Student application list
- `/student/application/:id` Student application form/details
- `/student/messages` Student messages
- `/oge` OGE master dashboard
- `/oge/application/:id` OGE application review
- `/program-chair/:id` Program Chair review
- `/student-life/:id` Student Life review
- `/dean/:id` Dean final approval

## Notes

- This repo is frontend-focused (UI and routing).
- API/database integration can be added in a backend service when required.
