# Database Rationalization Notes

## What we are optimizing for

This app needs to support three workspace classes:

- `GENERATOR`: can discover visible opportunities and submit applications
- `REVIEWER`: can review applications for the opportunities they are assigned to
- `ADMIN`: can configure opportunities, reviewer flows, and visibility

The same human can hold different workspace classes in different contexts. A user might be a generator globally, but only be a reviewer for one specific opportunity.

## Current pain points

- Role modeling mixes workspace identity with workflow job titles. Tables currently contain both top-level personas (`GENERATOR`, `REVIEWER`, `ADMIN`) and workflow-specific roles (`STUDENT_LIFE`, `PROGRAM_CHAIR`, `OGE_ADMIN`, `DEAN_ACADEMICS`).
- Opportunity visibility is already rule-based, which is good, but the login/session layer does not yet have a normalized context view for role selection.
- There are duplicate schema definitions across `src/lib/schema.ts`, `server/db/initSchema.js`, and `fastapi_app/main.py`, which makes drift very likely.
- Application history is spread across `application_reviews`, `application_decisions`, `application_remarks`, and `timeline_events`. That is workable for now, but it is not the long-term scalable write model.

## Recommended target model

### Keep

- `users`
- `roles`
- `user_roles`
- `email_groups`
- `email_group_memberships`
- `opportunity_visibility_rules`
- `opportunities`
- workflow template tables

### Add

- `user_scope_roles`
  - Purpose: assign a role in a context such as one opportunity
  - Example: `john.doe@plaksha.edu.in` can be `REVIEWER` for opportunity `1` while still being `GENERATOR` globally
- `user_role_contexts` view
  - Purpose: give the UI one queryable surface for “what role/workspace choices should this user see on login?”

## Recommended semantics

- `roles` should converge toward workspace roles first: `GENERATOR`, `REVIEWER`, `ADMIN`
- workflow-specific responsibilities such as student life or dean approval should live in workflow assignment tables, not in the top-level identity model
- `user_roles` should represent global access
- `user_scope_roles` should represent scoped access
- `opportunity_visibility_rules` should continue to grant generator-side opportunity access via exact email or group email rules

## Migration path

1. Stabilize the current DB bootstrap and keep SQLite as the only source of truth.
2. Introduce `user_scope_roles` and the `user_role_contexts` view.
3. Move login/session resolution to `user_role_contexts` so one user can pick from multiple valid workspaces.
4. Gradually remove workflow-job titles from `user_roles`.
5. After the access model is stable, collapse application action tables into a single `application_events` write model with read-friendly projections.

## Decision we should make next

Pick one direction for workflow ownership:

- Option A: keep workflow-specific tables (`workflow_templates`, `workflow_step_templates`, `reviewer_assignments`) and only rationalize identity/access right now
- Option B: also collapse workflow reviewer assignment into a more generic principal model in this pass

I recommend Option A first. It fixes the user-facing role/context problem with much lower migration risk.
