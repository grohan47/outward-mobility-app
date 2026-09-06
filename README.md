# Outward Mobility

OGE defines opportunities, student forms, and review levels. Students apply; reviewers receive only their assigned tasks and explicitly permitted student fields.

This consolidation is a development starting point. **Final verification is deferred at the owner's request. Clerk authentication and university deployment remain future work.** The seeded email login is development-only; setting `PRISM_ENV` to anything other than `development` prevents startup until production authentication is integrated.

## Local setup

Use Node 24 (see `.node-version`), npm 11, Python 3.13 or 3.14, and uv.

```bash
cp .env.example .env
npm ci
uv sync
npm run db:reset
npm run api:dev
```

`db:reset` deletes the current development database and seeds demo accounts. Stop the API before resetting. For an empty database instead, use `npm run db:init`. Database creation/reset is explicit; serving requests never resets data. A custom `PRISM_DB_PATH` must be exported in the shell for database commands as well as configured for the API.

In another terminal:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Demo accounts include `oge@plaksha.edu.in` (select OGE workspace), `rohan@plaksha.edu.in` (Student), and the seeded reviewer accounts in the login list. Publishing provisions the configured reviewers in the development identity store. Production identity will be replaced with Clerk in a separate task.

FastAPI owns the API, SQLite, and authorization. Next.js proxies `/api/*`, `/swagger`, and `/openapi.json` to `FASTAPI_BASE_URL`. Use one API process with the development session implementation; restarting it invalidates sessions.

## Editing an opportunity

The three steps are details, student form, and review levels. Manual edits and AI suggestions update one draft. Drafts can be reopened using `/admin/opportunities/new?draft=<id>`. Publishing creates an immutable version containing the opportunity details, form schema, and review definition. Applications retain the version they were submitted against.

Review levels are fixed in order. Reviewers inside a level run in parallel and must all approve. Each level has add controls, alternating backgrounds, generated connectors, and horizontal/vertical orientation. Select a reviewer to configure email, explicit field grants, reviewer-added fields, student-visible outputs, actions, and return behavior. Return to a level invalidates and repeats that level and every later level. Student returns allow correction and resubmission before review resumes.

AI assistance uses Anthropic when configured, and reports unavailable generation instead of silently publishing guessed policy. The full guided conversational experience can be expanded in the later functionality pass.

## Continuing work

- [Cleanup decisions and remaining work](docs/rationalization-plan.md)
- [Branch archive and recovery](docs/branch-consolidation.md)
- [Opportunity JSON contract](docs/opportunity-definition.md)

When the testing hold is lifted, run `npm run typecheck`, `npm run lint`, `npm run test:api`, and `npm run build`, then verify the three-role flow and graph layouts in a browser. Existing test files are retained work in progress; these commands have not been certified against the final consolidation.
