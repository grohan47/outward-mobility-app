# Rationalization and implementation handoff

## Decisions confirmed by the owner

- All existing database content is disposable; establish a clean schema instead of maintaining migrations for abandoned prototypes.
- OGE creates opportunities. Students apply. Reviewer is a distinct workspace.
- Levels execute in order. All reviewers within one level must approve before advancement.
- A return invalidates the target level and every later level. Those reviews run again.
- The deployment target is a university server. Clerk integration, broad UI redesign, and expanded functionality are separate tasks.
- Consolidate useful branch work into main and remove obsolete branch pointers after archiving them.
- Final tests, lint, type checking, build, and browser verification are paused to conserve usage. Implementation is not a verified release.

## Baseline selected

The original main was `e903a4e`. The more recent `ai-rework` tip `7dd37fb` contained useful AI drafts, opportunity details, and graph work. It was integrated before cleanup. The alternative Svelte/Vite applications, duplicate chat implementation, movable V2 graph prototypes, and old checkpoints are preserved in archive tags rather than reintroduced as competing implementations. See the branch record for exact references.

## Implemented structure

| Area | Consolidated approach |
| --- | --- |
| Runtime | Next.js 16 / React 19 frontend, FastAPI backend, SQLite; Node 24 and uv lockfiles |
| Database | One schema.sql baseline, explicit init/reset command, versioned definitions |
| Opportunity editor | One draft state shared by three steps and AI suggestions |
| Graph | Ordered levels, fixed reviewer cards, generated split/join connectors, side inspector |
| Execution | One transaction-based level engine, per-attempt tasks, unanimous parallel barrier |
| Returns | Student correction or earlier-level rerun, invalidating downstream decisions |
| Access | Server projection of explicitly granted fields, scoped task inboxes and comments |
| Identity | Signed development sessions; production startup requires later authentication work |
| Documentation | Current setup, contract, plan, and branch recovery replace stale progress reports |

The old Node/SQLite backend, Next server database/action implementation, ReactFlow canvas, stale SQL migrations, duplicate heuristic AI creation logic, manual OpenAPI file, obsolete agent hooks, and prototype scripts have been removed. FastAPI's generated OpenAPI remains the API reference. Application comments remain supported with internal/student-visible scope; a separate threaded-chat subsystem was not revived.

Published definitions capture form labels/types/options and workflow configuration. New versions cannot silently alter existing application schemas. Draft ownership and update timestamps protect edits; publishing is the only operation that changes the opportunity configuration. Admin edits to active student submissions restart review so prior approvals cannot silently cover modified answers.

Reviewers start with no student field access. OGE selects fields explicitly, including outputs created in earlier levels. Reviewer outputs can separately be made visible to students. Action and required-input validation occurs on the server. Inbox/SLA responses mask identity when the reviewer lacks the name grant.

## Review policy boundaries

The supported model is ordered unanimous levels. Conditional/join-any graphs and arbitrary edges do not belong to this editor. An optional equality rule can return a completed level to a prior level or the student; at most one automatic rule per level avoids conflicting destinations. Repeated returns are capped at ten attempts and pause processing for operator attention. A dedicated operator recovery flow for this cap is still needed before deployment.

Legacy forward graphs are an import boundary, while levels are authoritative. Fixed positions are presentation only. Review policy is never inferred from where a card happens to sit.

## Remaining work, in order

1. Lift the verification hold and repair any findings from type checking, lint, API tests, build, and browser review. Existing test updates made before the hold are not completion evidence. Exercise parallel approval, stale actions, student correction, earlier-level return, output grants, immutable versions, draft reload/conflicts, and narrow/vertical/horizontal graph layouts.
2. Integrate Clerk and define trusted role provisioning, account lifecycle, and reviewer invitation behavior. Replace the seeded login and single-process development session behavior.
3. Prepare university operations: reverse proxy/TLS, process supervision, environment secrets, database volume/backup/restore, logs, health monitoring, and deployment rollback. Configure reminders explicitly; verify delivery separately.
4. Expand AI into a deliberate guided conversation through all three editor steps, with explicit unresolved questions and reproducible draft edits. Improve extracted-fact provenance and eligibility policy without inventing facts or reviewer authority.
5. Carry out the later UI/clutter pass, accessibility/browser coverage, attachment handling, and administrative recovery for paused review loops.

No public deployment, production authentication, external email delivery verification, or final release certification is included in this consolidation.
