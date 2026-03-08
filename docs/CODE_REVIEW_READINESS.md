# PRISM Code Review Readiness

This document directly answers the 5 review checkpoints and upcoming mid-sem expectations.

## 1) Product Pitch

### Product
PRISM (Plaksha Review Interface for Student Mobility) is a workflow product for managing outbound student mobility applications end-to-end.

### Problem it solves
Current process is fragmented (forms, email threads, manual handoffs), making it hard to track ownership, stage status, and audit trail.

### Value proposition
- Single application record per submission.
- Stage-by-stage routing with decision trail.
- Role-scoped visibility for privacy.
- Faster turn-around and less email chaos.

### Onboarding model
- Organization onboarding: OGE admin sets opportunities, stage sequencing, and reviewer mappings.
- User onboarding: users sign in with role-based access (Student, UG Academics, Student Life, Program Chair, OGE Admin, Dean).
- Student onboarding: linked student profile is created from official university records.

## 2) User Journeys (Current + Future Scope)

### Student
- Why login: submit/manage own applications and see status.
- Journey now:
  1. Open new application form.
  2. Submit application.
  3. Track active applications and timeline.
  4. Resubmit when flagged back for corrections.
- Earlier process: spreadsheet/email/manual office tracking.
- Future scope: richer document upload checks and AI guidance before submission.

### UG Academics
- Why login: verify academic eligibility.
- Journey now:
  1. Open assigned application.
  2. Review details and submit decision (approve/flag).
- Earlier process: ad-hoc file exchange and comments.
- Future scope: eligibility rule automation.

### Student Life
- Why login: evaluate discipline/engagement context.
- Journey (planned in pitch): stage review with remarks and flag option.
- Future scope in current semester acknowledged.

### Program Chair
- Why login: assess course compatibility and academic suitability.
- Journey (planned in pitch): review, annotate, approve/flag.
- Future scope: structured course mapping checks.

### OGE Admin
- Why login: routing, operational monitoring, and governance.
- Journey now:
  1. View dashboard list.
  2. Open application details.
  3. Submit decision (including reject).
- Future scope: reminders/escalations dashboard.

### Dean Academics
- Why login: final approval/rejection authority.
- Journey (planned in pitch): final review and terminal decision.

## 3) Databases in Use

### Runtime database
- SQLite file: `server/db/prism.sqlite`

### Tables currently defined
- `users`
- `roles`
- `user_roles`
- `student_profiles`
- `opportunities`
- `workflow_stages`
- `applications`
- `application_student_snapshot`
- `application_documents`
- `application_reviews`
- `application_decisions`
- `application_remarks`
- `timeline_events`

### Data model summary
- `student_profiles` is master university data.
- `applications` is workflow main object.
- One student can have many applications.
- Snapshot table preserves official values at submission time.

## 4) API Endpoints Involved

Implemented in `server/httpServer.js`:

### Health
- `GET /api/health`

### Applications
- `GET /api/applications`
- `GET /api/applications?studentProfileId=1`
- `GET /api/applications/:id`
- `POST /api/applications`
- `POST /api/applications/:id/resubmit`

### Reviews/Decisions
- `POST /api/reviews/submit`

<!--
TEMP API BACKLOG (for review discussion only)

Workflow action endpoints (explicit stage movement)
- POST /api/applications/:id/actions/approve
- POST /api/applications/:id/actions/flag
- POST /api/applications/:id/actions/reject
- POST /api/applications/:id/actions/resubmit

Expected action side effects
- insert application_reviews row
- insert application_decisions row
- update applications.current_stage and applications.final_status
- insert timeline_events row

Role-filtered stakeholder inbox endpoints
- GET /api/inbox/student?userId=:id
- GET /api/inbox/student-life?userId=:id
- GET /api/inbox/program-chair?userId=:id
- GET /api/inbox/oge?userId=:id
- GET /api/inbox/dean?userId=:id

Workflow visibility/status endpoints
- GET /api/applications/:id/workflow
- GET /api/applications/:id/timeline
- GET /api/applications/:id/reviews
- GET /api/applications/:id/decisions
- GET /api/applications/:id/stakeholders

Dashboard summary endpoints
- GET /api/dashboard/student?userId=:id
- GET /api/dashboard/student-life
- GET /api/dashboard/program-chair
- GET /api/dashboard/oge
- GET /api/dashboard/dean

Document management endpoints
- GET /api/applications/:id/documents
- POST /api/applications/:id/documents
- PATCH /api/applications/:id/documents/:documentId
- DELETE /api/applications/:id/documents/:documentId

Notification endpoints
- GET /api/notifications?userId=:id
- POST /api/notifications/:id/read
- POST /api/notifications/read-all
-->

## 5) Code Understanding / Where Things Live

### Workflow and role constants
- `server/config/workflow.js`
- `server/config/roles.js`
- `server/config/visibility.js`

### DB initialization and schema
- `server/db/sqliteClient.js`
- `server/db/initSchema.js`

### Business logic
- `server/services/applicationService.js`
- `server/services/reviewService.js`
- `server/services/workflowService.js`
- `server/services/accessService.js`

### Recent code tidiness updates
- `applicationService` now uses `EVENT_TYPES` constants for timeline event names.
- Added helper methods in `applicationService`:
  - `getNowIso()` for timestamp creation.
  - `getStudentProfile(studentProfileId)` for profile lookup.
- Refactor was non-functional (readability/maintainability only) and keeps workflow behavior unchanged.

### Data access layer
- `server/repositories/*`

### Frontend API integration
- `src/api/client.js`
- `src/screens/StudentApplicationForm.jsx`
- `src/screens/StudentApplicationsList.jsx`
- `src/screens/OGEMasterDashboard.jsx`
- `src/screens/OGEApplicationReview.jsx`

## Current Completion Against Review Expectation

- Product pitch: defined.
- User journeys: defined with scoped future items.
- Databases in use: defined and implemented (SQLite).
- API endpoints: implemented for core application/review flows.
- Code understanding: file-level mapping documented above.

## Mid-Sem Readiness Notes

### Non-AI endpoints status
- Core non-AI endpoints started and functional for submit/list/review/resubmit.
- Remaining non-AI endpoints to complete: richer documents CRUD, stage assignment APIs, role-filtered review inbox endpoints.

### AI endpoint requirement (planned)
- Candidate AI endpoint: `POST /api/ai/summarize-application-remarks`.
- Purpose: summarize internal review remarks for OGE/Dean.

### AI evaluation strategy (planned)
- Metrics:
  - faithfulness (summary matches source remarks)
  - coverage (key decisions/flags preserved)
  - actionability (reviewer usefulness score)
- Benchmarking:
  - fixed evaluation set of historical remark threads
  - compare baseline prompt vs improved prompt templates
  - human rating rubric for 20-30 samples

## Commands for Viva Demo

```bash
npm run db:init
npm run server:dev
npm run dev
```

Optional checks:

```bash
npm run smoke:server
npm run build
```
