# Rationalization and implementation handoff

## Decisions confirmed by the owner

- All existing database content is disposable; establish a clean schema instead of maintaining migrations for abandoned prototypes.
- OGE creates opportunities. Students apply. Reviewer is a distinct workspace.
- Levels execute in order. All reviewers within one level must approve before advancement.
- A return invalidates the target level and every later level. Those reviews run again.
- The deployment target is a university server. Clerk integration, broad UI redesign, and expanded functionality are separate tasks.
- Consolidate useful branch work into main and remove obsolete branch pointers after archiving them.
- The verification hold was lifted on 6 September 2026. The completed test pass and its remaining limits are recorded below.

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

## Roadmap status

1. **Completed 6 September 2026:** lift the verification hold, repair findings, and exercise type checking, lint, API tests, build, browser role flows, parallel approval, stale actions, student correction, earlier-level return, output grants, immutable versions, draft conflicts, and narrow/vertical/horizontal graph layouts. See Testing Results below.
2. Integrate Clerk and define trusted role provisioning, account lifecycle, and reviewer invitation behavior. Replace the seeded login and single-process development session behavior.
3. Prepare university operations: reverse proxy/TLS, process supervision, environment secrets, database volume/backup/restore, logs, health monitoring, and deployment rollback. Configure reminders explicitly; verify delivery separately.
4. Expand AI into a deliberate guided conversation through all three editor steps, with explicit unresolved questions and reproducible draft edits. Improve extracted-fact provenance and eligibility policy without inventing facts or reviewer authority.
5. Carry out the later UI/clutter pass, accessibility/browser coverage, attachment handling, and administrative recovery for paused review loops.

No public deployment, production authentication, external email delivery verification, or final release certification is included in this consolidation.

## Testing Results — 6 September 2026

### Verified scope

- `uv run --locked pytest -q`: **43 passed, 7 skipped**. The skipped cases call the real Anthropic service and require credentials; mocked AI contract tests passed. The suite still emits nine non-failing warnings for Starlette/httpx deprecations and an unregistered `integration` marker.
- The separate-connection unanimous-approval concurrency case passed 20 consecutive repetitions.
- Persistent API coverage now includes manual draft create/reload/update, stale `expectedUpdatedAt` rejection with HTTP 409, immutable published definitions, explicit reviewer-output grants, and student-visible reviewer outputs.
- `npm run lint`, `npm run typecheck`, and `npm run build` passed under Node 24.16.0/npm 11.16.0 through Volta. Next.js 16.3.4 compiled successfully and generated all 16 application pages.
- Real headless Chromium exercised exact-email OGE sign-in, workspace selection, the administrator dashboard, opportunity list/editor, reviewer inbox/detail and required inputs, student feedback/rework/resubmission, reopened review, and vertical/horizontal graph controls.
- Direct integration through the Next proxy exercised draft save/reload/conflict/publish, student submission, explicit field projection, student-visible versus internal comments, parallel unanimous approval, downstream reviewer advancement, final approval, and stale-action rejection.
- At 1440 px, vertical and horizontal graph layouts render without document overflow. At 360 px, the desktop sidebar is hidden, the workflow retains a 294 px client width, vertical nodes remain contained, and horizontal mode scrolls inside its canvas rather than widening the document.

### Bugs fixed during validation

- Updated the AI generation prompt from the retired arbitrary node/edge format to ordered unanimous levels with explicit field grants. The former prompt could produce a syntactically successful draft that the current policy correctly refused to publish.
- Re-encoded the session cookie when Next server components forward it to FastAPI. Previously, email login and workspace selection succeeded, but a protected server-rendered route could reject the decoded cookie and redirect back to login.
- Removed frontend lint/type failures involving unknown timeline payload values, an unescaped apostrophe, stale hook patterns, unused props, and opportunity-editor state setters.
- Made the shared sidebar and role-layout offsets responsive so narrow screens no longer collapse the main workflow area.
- Based graph SVG sizing on the container and node bounds, eliminating a self-amplifying scroll-width feedback loop when switching orientation.
- Disabled restricted SLA-notification polling in the student header, avoiding repeated HTTP 403 responses on student pages.
- Added regression tests for optimistic draft conflicts and reviewer-output projection.

### Local run instructions

This checkout already had a repository-local `.venv`; validation reused it with `uv sync --locked`. No separate new uv environment was created. The shell default is Node 20, which is outside this project's `>=24.15 <25` engine range, so use Volta explicitly.

One-time setup:

```bash
cd /home/rgcodes/Programming/outward-mobility-app
cp .env.example .env                # skip if .env already exists
uv sync --locked
volta run --node 24.16.0 --npm 11.16.0 npm ci
volta run --node 24.16.0 --npm 11.16.0 npm run db:reset
```

`db:reset` replaces the local development database and loads demo data. Use `npm run db:init` instead when an empty database is wanted. If `PRISM_DB_PATH` is customized, export the same absolute path for both the database command and the API process.

Start FastAPI in terminal 1:

```bash
cd /home/rgcodes/Programming/outward-mobility-app
volta run --node 24.16.0 --npm 11.16.0 npm run api:dev
```

Start Next in terminal 2:

```bash
cd /home/rgcodes/Programming/outward-mobility-app
volta run --node 24.16.0 --npm 11.16.0 npm run dev
```

Open `http://localhost:3000`. Development login is intentionally email-only: the normalized email must exactly match an active seeded account. Useful targets are `oge@plaksha.edu.in` for OGE/Administrator, `rohan@plaksha.edu.in` for Student, and `oaa@plaksha.edu.in` for Reviewer. A missing `.env` causes `npm run api:dev` to stop immediately with `Path '.env' does not exist`.

### Safe next testing steps

1. Add the successful Chromium role-flow and graph-layout scenarios as a maintained Playwright suite instead of relying on an ad hoc validation script.
2. Register the pytest `integration` marker and update the TestClient stack when the FastAPI/Starlette replacement for the deprecated httpx bridge is selected.
3. Run the seven live Anthropic extraction cases only when a disposable development key is intentionally provided; keep manual opportunity creation as the credential-free baseline.
4. Establish a deliberate Ruff baseline before treating Python lint as a release gate. The current optional `ruff check fastapi_app` command reports 142 pre-existing style/static findings and was not part of the documented npm lint gate.
5. Repeat the responsive smoke test in another supported browser and add keyboard/accessibility assertions. Clerk, university deployment readiness, email delivery, and release certification remain separate work.
