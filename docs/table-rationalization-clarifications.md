# Table Rationalization Draft + Clarifications

This draft proposes a **minimal, scalable table set** for the workflow:

- A user can act as Generator, Reviewer, and/or Administrator depending on context.
- Opportunity creators configure both:
  - who can apply (generator visibility), and
  - who reviews + in what order.
- Each application has a timeline of steps and an explicit current stage.

## Proposed Core Tables

1. **users**
   - `id`, `email`, `name`, auth metadata.
   - One row per person.

2. **roles**
   - `id`, `code` (`GENERATOR`, `REVIEWER`, `ADMIN`), label.
   - Reference table only.

3. **user_global_roles**
   - `user_id`, `role_id`.
   - Defines what workspaces a user can switch into.

4. **opportunities**
   - Opportunity metadata, status, creator id.

5. **opportunity_visibility_rules**
   - `opportunity_id`, `rule_type` (`EMAIL`, `GROUP_EMAIL`), `rule_value`.
   - Defines who can submit applications for that opportunity.

6. **opportunity_reviewer_steps**
   - `opportunity_id`, `step_order`, `reviewer_email` (or reviewer_user_id), `allowed_actions`.
   - Ordered chain of reviewers per opportunity.

7. **applications**
   - `id`, `opportunity_id`, `applicant_user_id`, `status`, `current_step_order`, timestamps.

8. **application_step_events**
   - Immutable event log/timeline entries:
     - submit, approve_step, reject_step, comment, reassignment, etc.
   - Includes actor, step, note, created_at.

## Tables We Should Avoid (or Merge)

- Separate `administrators` table (usually redundant if role assignment is in `user_global_roles`).
- Multiple near-duplicate workflow tables split by role.
- Separate ad-hoc “timeline” table if it duplicates approval events already captured in `application_step_events`.

## Why this is scalable

- **Role context is explicit** (global workspace role + per-opportunity reviewer assignment).
- **Authorization is composable**:
  - can user enter workspace? → `user_global_roles`
  - can user apply? → `opportunity_visibility_rules`
  - can user act at current step? → `opportunity_reviewer_steps` + `applications.current_step_order`
- **Timeline is append-only** for audits and replay.

## Clarifications Needed Before Finalizing Schema

1. Should reviewer assignment be stored by `reviewer_email` (stable across org exports) or strict FK `reviewer_user_id` (stronger integrity)?
2. Can one step have **multiple reviewers** (parallel approval), or exactly one reviewer per step?
3. Do you need **conditional routing** (e.g., branch to different reviewer based on amount/country), or only linear chains?
4. Should admins always have access to the **Admin workspace** but only review when present in reviewer steps (current desired behavior)?
5. For visibility rules, should matching be:
   - Any rule match allows apply (OR semantics), and
   - Empty rules means open to all generators?
6. Do applications ever need reassignment history (reviewer changed mid-step) preserved for audit?
7. Do you want a hard requirement that every opportunity has at least one reviewer step before publish?
8. Should “final approval” be represented only by `applications.status`, or also by an explicit terminal event in `application_step_events`?
9. Are there legacy tables you want preserved for backward compatibility, or can we migrate and deprecate aggressively?

## Recommended Next Step

After answers to the 9 points above, we can produce a single migration plan:

1. final target ERD,
2. table-by-table deprecation map,
3. data backfill strategy,
4. zero-downtime rollout sequence.
