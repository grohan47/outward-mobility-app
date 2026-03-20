# PRISM Configurable Approvals Platform: Midsem Progress

**Goal:** Transform the PRISM prototype into a generalized approvals platform, seeded with the OGE Outward Mobility workflow, achieving ≥70% backend endpoint implementation.

## Sprint Metrics
* **Total Endpoints Planned:** 33
* **Endpoints Implemented:** 24 (73%)
* **Status:** <span style="color:green; font-weight:bold;">🟢 ON TRACK (Midsem Target Met)</span>

---

## 🟢 Implemented (Completed for Midsem)

**Group A: Utility / Core**
1. `GET /api/health` — Returns system health and DB readiness.
2. `GET /api/users/me` — Returns current logged-in session user.

**Group B: Generator (Student) Surface**
3. `GET /api/opportunities` — Lists published program opportunities.
4. `GET /api/opportunities/:id` — Details of specific opportunity (incl. form schema).
5. `POST /api/applications` — Creates an application (links user profile + opportunity).
6. `GET /api/my/applications` — Lists active/past applications for logged-in student.
7. `GET /api/applications/:id` — (Shared) Full application JSON including history timeline, reviews, snapshot.

**Group C: Reviewer Surface (Configurable Roles)**
8. `GET /api/reviewer/inbox` — Fetches applications assigned to logged-in reviewer based on workflow config.
9. `POST /api/applications/:id/approve` — Approves step, automatically advances `current_stage` to next step, logs timeline & review.
10. `POST /api/applications/:id/request-changes` — Flags application, sends back to `STUDENT_SUBMISSION`, logs visible review.
11. `POST /api/applications/:id/reject` — Closes workflow with `final_status=REJECTED` (restricted to OGE/Dean).
12. `POST /api/applications/:id/comments` — Adds a remark/comment with `internal` or `generator_visible` scoping.
13. `GET /api/applications/:id/comments` — Fetches application comments.

**Group D: Admin (OGE) Surface**
14. `GET /api/admin/dashboard/summary` — Aggregates counts (total, pending, awaiting action, approved) for master dashboard.
15. `GET /api/admin/applications` — Fetches complete, unfiltered ledger of all applications across all workflows.

---

## 🟡 Partial / Mocked (Functional MVP)

**Group E: Form & Workflow Templates**
16. *Database seed layer functions as the API substitute for midsem.* The DB is initialized with `form_templates` (JSON schemas) and `workflow_templates` (sequential step arrays).
17. Opportunities reference these templates to dynamically build approval chains. Full CRUD endpoints deferred to post-midsem.

**Group F: Authentication**
18. `POST /actions/login` (Next.js server action) — Email-based pseudo-auth. Associates email with role configuration to drive reviewer visibility.

---

## ⚪ Planned for Final Release

**Advanced Management APIs**
19. `POST /api/admin/opportunities`
20. `PATCH /api/admin/opportunities/:id`
21. `POST /api/admin/workflow-templates`
22. `PATCH /api/admin/workflow-templates/:id`
23. `POST /api/admin/form-templates`

**AI Assistant Integration (Stubs existing)**
24. `POST /api/ai/validate-application`
25. `POST /api/ai/suggest-workflow`
26. `POST /api/ai/summarize-application`
