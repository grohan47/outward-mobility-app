# Endpoint Gap Implementation Report

## Purpose

This report answers:

1. Which missing or partially wired backend/frontend flows are easy to implement now
2. Which ones require product or architectural confirmation first
3. Which ones I can implement safely without more input
4. Which ones I should not implement until you confirm desired behavior

This is based on the current repository state, especially:

- [src/components/admin/OpportunityStudio.tsx](c:/Users/sidme/OneDrive/Desktop/AI-PROD/outward-mobility-app-next/src/components/admin/OpportunityStudio.tsx)
- [src/app/reviewer/applications/[id]/page.tsx](c:/Users/sidme/OneDrive/Desktop/AI-PROD/outward-mobility-app-next/src/app/reviewer/applications/[id]/page.tsx)
- [src/components/admin/OpportunityEditor.tsx](c:/Users/sidme/OneDrive/Desktop/AI-PROD/outward-mobility-app-next/src/components/admin/OpportunityEditor.tsx)
- [fastapi_app/main.py](c:/Users/sidme/OneDrive/Desktop/AI-PROD/outward-mobility-app-next/fastapi_app/main.py)
- [server/services/applicationService.js](c:/Users/sidme/OneDrive/Desktop/AI-PROD/outward-mobility-app-next/server/services/applicationService.js)
- [TODOS.md](c:/Users/sidme/OneDrive/Desktop/AI-PROD/outward-mobility-app-next/TODOS.md)

---

## Executive Summary

There are very few outright missing routes for what the current frontend tries to call. The bigger issue is that several important capabilities are either:

- present in FastAPI but not wired from the UI
- only persisted indirectly
- still split between legacy ordered-workflow semantics and graph-native semantics

The easiest safe wins are:

1. Wire AI clarification answers to the existing draft answer endpoint
2. Add stronger frontend/server validation synchronization around draft save/publish
3. Add draft listing and draft deletion/archive endpoints if you want draft lifecycle to become visible in UI

The most important items that need your confirmation are:

1. Whether reviewer decisions should move from legacy application actions to graph task actions
2. Whether graph editing should persist directly to the database before publish
3. Whether workflow drafts are temporary save buffers or first-class long-lived editable artifacts
4. Whether the field catalog should become a separately manageable library

---

## Current State

### Frontend Calls That Already Have Backing Routes

These are already covered by FastAPI:

- Auth/session
  - `/api/auth/login`
  - `/api/auth/logout`
  - `/api/auth/me`
  - `/api/auth/select-workspace`
- Opportunity read/write
  - `/api/admin/opportunities`
  - `/api/admin/opportunities/{id}`
  - `/api/admin/opportunities/{id}/graph`
  - `/api/admin/opportunities/ai-generate`
- Draft flow
  - `/api/admin/workflow-drafts/manual`
  - `/api/admin/workflow-drafts/{id}`
  - `/api/admin/workflow-drafts/{id}/publish`
  - `/api/admin/workflow-drafts/{id}/answer`
- Applications
  - `/api/applications`
  - `/api/applications/{id}`
  - `/api/applications/{id}/approve`
  - `/api/applications/{id}/request-changes`
  - `/api/applications/{id}/student-response`
  - `/api/applications/{id}/reject`
  - `/api/applications/{id}/comments`
- Reviewer/admin inbox and admin patching
  - `/api/reviewer/inbox`
  - `/api/reviewer/tasks`
  - `/api/reviewer/tasks/{task_id}/decide`
  - `/api/admin/applications`
  - `/api/admin/applications/{id}`

### Main Gaps Are Not Route Absence

The real gaps fall into these buckets:

- backend route exists but UI does not use it
- route does not exist for a desirable lifecycle operation
- persistence happens only by creating draft rows, not by updating existing artifacts
- legacy and graph runtimes still overlap in ways that make “obvious” endpoint additions risky

---

## Easy To Implement Now

These are low-risk and mostly local in scope.

### 1. Wire Clarification Answers To Draft Endpoint

### Why it is easy

- Backend route already exists at `/api/admin/workflow-drafts/{draft_id}/answer`
- Frontend already collects answers in local state
- Current `submitAnswers()` in [OpportunityStudio.tsx](c:/Users/sidme/OneDrive/Desktop/AI-PROD/outward-mobility-app-next/src/components/admin/OpportunityStudio.tsx) is only a stub

### What implementation would involve

- track the active `draft_id` from AI generation
- call the answer endpoint with the current answers payload
- refresh the returned draft in UI state
- surface errors and updated clarifying questions/warnings

### Risk

- Low

### Confirmation needed

- None, unless you want a specific UX for “answer submitted, regenerate automatically vs manually”

### My recommendation

- Implement immediately

---

### 2. Add Draft List Endpoint

### Why it is relatively easy

- `workflow_drafts` table already exists
- current system already creates and fetches single drafts
- list route can be read-only first

### What implementation would involve

- add `GET /api/admin/workflow-drafts`
- return recent drafts, likely newest first
- optionally filter by `opportunity_id`, `status`, `created_by_email`

### Risk

- Low to medium

### Confirmation needed

- Small product confirmation:
  - should list include all drafts or only for current opportunity
  - should drafts be visible cross-admin

### My recommendation

- Safe to implement once you confirm visibility rules

---

### 3. Add Draft Delete Or Archive Endpoint

### Why it is relatively easy

- isolated to draft lifecycle
- does not affect published graph versions if implemented correctly

### What implementation would involve

- add `DELETE /api/admin/workflow-drafts/{id}` or `POST /archive`
- enforce “cannot delete published reference if policy forbids it”
- likely soft-delete is safer than hard delete

### Risk

- Medium only because draft lineage is not yet formalized

### Confirmation needed

- Should delete be hard delete or archive
- Should any admin be allowed to delete another admin’s draft

### My recommendation

- Do only after visibility/ownership is confirmed

---

### 4. Add Server Validate-Only Endpoint For Draft/Graph

### Why it is useful and manageable

- Current `validateForPublish()` is frontend-local
- backend already runs graph validation during manual draft creation
- a validate-only endpoint would make frontend validation match publish rules

### What implementation would involve

- add `POST /api/admin/workflow-drafts/validate` or similar
- accept opportunity + graph payload
- run same `GraphPolicyValidator` and publish-readiness logic
- return warnings and readiness

### Risk

- Low

### Confirmation needed

- None, unless you want validation to create a DB draft row or remain ephemeral

### My recommendation

- Good safe improvement

---

### 5. Add Standalone Reviewer Task Detail Endpoint

### Why it is manageable

- reviewer task list already exists
- decision endpoint already exists
- task detail endpoint can be additive, not disruptive

### What implementation would involve

- add `GET /api/reviewer/tasks/{task_id}`
- return application summary, visible fields, node config, reviewer inputs, comments permissions

### Risk

- Medium

### Confirmation needed

- Whether you want a graph-native reviewer detail page now, or only the route for later

### My recommendation

- Safe to add backend-first, but UI migration should wait for confirmation

---

## Easy Backend Work But Needs Product Confirmation

These are technically feasible, but behavior matters enough that I should not guess.

### 1. Move Reviewer Decision UI To `/api/reviewer/tasks/{task_id}/decide`

### Why this needs confirmation

Today reviewer detail still posts to legacy application-level actions:

- approve
- request changes
- reject

But graph-native reviewer task decisions already exist.

The missing piece is not coding difficulty. It is deciding:

- Should all reviewer decisions now go through graph task semantics
- Should legacy opportunities still use old endpoints
- Should one reviewer detail page support both modes or split into two pages

### Technical difficulty

- Medium

### Product/behavior risk

- High

### What can break if guessed wrong

- reviewer mental model
- request_changes routing
- task ownership semantics
- active task visibility

### My recommendation

- Do not switch this without your explicit approval

---

### 2. Add Direct Graph Save Endpoint

Example:

- `PATCH /api/admin/opportunities/{id}/graph`
- or `PUT /api/admin/workflow-drafts/{id}/graph`

### Why this needs confirmation

Right now the system’s architectural bias is:

- graph edits live in editor state
- persistence happens through manual draft creation
- publish happens from draft to graph version

Adding direct graph save changes the product concept:

- Are we saving a working draft graph
- Are we mutating the active published graph
- Are we creating a new draft revision

### Technical difficulty

- Medium

### Product/architecture risk

- High

### My recommendation

- Do not implement until you decide whether drafts or opportunity graph versions are the canonical editable object

---

### 3. Add Workflow Draft Update Endpoint

Example:

- `PATCH /api/admin/workflow-drafts/{id}`

### Why this needs confirmation

This depends on what a workflow draft is supposed to be:

- immutable snapshot rows
- mutable working documents
- revisioned objects with optimistic concurrency

Right now the system behaves like “create a new draft row” more than “edit a single durable draft.”

### Technical difficulty

- Medium

### Product risk

- High because it affects stale-draft semantics and overwrite behavior already called out in [TODOS.md](c:/Users/sidme/OneDrive/Desktop/AI-PROD/outward-mobility-app-next/TODOS.md)

### My recommendation

- Wait for explicit draft model confirmation

---

### 4. Add Field Catalog CRUD Endpoints

Examples:

- `POST /api/form-fields`
- `PATCH /api/form-fields/{field_key}`
- `DELETE /api/form-fields/{field_key}`

### Why this needs confirmation

Today field catalog behavior is philosophically mixed:

- reusable field library
- opportunity-scoped custom fields upserted through opportunity save flows

Before adding full CRUD, we need to know:

- Are custom fields promoted into the global library
- Can admins edit a shared field that other opportunities already use
- Is there ownership/versioning for field definitions

### Technical difficulty

- Medium

### Product/data risk

- High because shared field edits can have cross-opportunity consequences

### My recommendation

- Confirm the field-library product model first

---

## Harder Work That Definitely Needs Confirmation

### 1. Full Graph-Native Reviewer Workflow Conversion

This means:

- reviewer inbox entries keyed by task identity
- reviewer detail page driven by task detail
- decisions posted through task endpoint
- legacy application-stage action endpoints gradually retired for graph opportunities

### Why it is not a quick win

- It crosses frontend, backend, and user mental model boundaries
- It changes institutional behavior, not just code structure

### My recommendation

- Treat as a deliberate migration track, not a small endpoint addition

---

### 2. Reviewer-To-Reviewer Return Edges

This has come up in the architectural analysis already.

### Why it needs confirmation

Current graph runtime hardcodes `request_changes` toward student rework, not reviewer return edges.

This is not an endpoint-only task. It affects:

- graph execution semantics
- stale task handling
- return target state
- task invalidation/resumption

### My recommendation

- Not an “easy implement”
- Needs explicit workflow semantics from your side

---

### 3. Draft Versioning / Stale Publish Protection

This is already a known TODO.

### Why it is hard

- needs revision model
- likely needs optimistic locking or last-updated checks
- likely needs UI conflict messaging

### My recommendation

- Worth doing, but not until you confirm expected admin collaboration model

---

## What I Can Implement Right Now Without More Input

These are the items I can safely do next if you want me to proceed:

1. Wire `submitAnswers()` to `/api/admin/workflow-drafts/{id}/answer`
2. Add a backend validate-only endpoint so the UI can run server-truth validation before publish
3. Add a basic `GET /api/admin/workflow-drafts` listing endpoint
4. Add a basic `GET /api/reviewer/tasks/{task_id}` detail endpoint without changing the current reviewer UI

These are low-risk because they are additive and don’t force a workflow model change.

---

## What I Need You To Confirm Before I Implement

Please confirm these before I touch them:

### A. Reviewer Action Model

Should reviewer actions for graph opportunities move to:

- graph task decisions only
- legacy application decisions only
- hybrid mode depending on application type

This is the single biggest confirmation needed.

### B. Draft Model

Should `workflow_drafts` behave as:

- append-only snapshots
- editable working drafts
- revisioned drafts with conflict detection

This determines whether I should add patch/update endpoints or continue with create-new-draft semantics.

### C. Graph Persistence Model

When an admin clicks save in the pipeline editor, should it:

- save a workflow draft row only
- update an existing draft
- update a separate opportunity-graph working copy

This changes the safest backend shape.

### D. Field Catalog Ownership Model

Should custom form fields:

- remain opportunity-local only
- be promotable into a shared library
- be shared globally by default

This determines whether field CRUD is safe to add.

### E. Draft Visibility

Should admins see:

- only their own drafts
- all drafts for an opportunity
- all drafts system-wide

This affects any list/delete/archive implementation.

---

## Recommended Implementation Order

### Phase 1: Safe additive work

1. Wire draft clarification answer flow
2. Add validate-only endpoint
3. Add workflow draft list endpoint

### Phase 2: Backend prep without user workflow disruption

4. Add reviewer task detail endpoint
5. Add optional draft archive endpoint

### Phase 3: Requires your confirmation

6. Decide reviewer action model
7. Decide draft mutability model
8. Decide graph direct-persistence model
9. Decide field catalog ownership model

### Phase 4: Only after confirmation

10. Implement graph-native reviewer decision flow
11. Implement draft patch/versioning/conflict controls
12. Implement field library CRUD

---

## Practical Recommendation

If you want the fastest high-value next move with minimal risk, I recommend:

1. implement draft clarification answer persistence
2. implement server-side validate-only
3. add draft list endpoint

Those three give immediate product value and close real gaps without forcing us to choose the final graph-vs-legacy reviewer model yet.

If you want, I can start implementing the “safe additive work” set next with no further architectural risk.
