# PRISM Server Scaffold (V1)

This folder contains a minimal, easy-to-navigate implementation scaffold for PRISM backend logic.

## Goal

Keep workflow and access control logic centralized while staying simple enough for rapid implementation.

## Folder Guide

- `config/`: constants and fixed workflow definitions.
- `db/`: table catalog and schema planning metadata.
- `repositories/`: SQLite-backed table-level data access abstractions.
- `services/`: business rules and workflow orchestration.
- `index.js`: service/repository composition root.

## Design Rules

1. Keep stage names in `config/workflow.js` only.
2. All transitions go through `services/workflowService.js`.
3. Access checks live in `services/accessService.js`.
4. Repository files should not contain business decisions.
5. Every decision should create a timeline event.

## Next Step (Implementation)

Run database initialization:

```bash
npm run db:init
```

Run workflow smoke test:

```bash
npm run smoke:server
```

SQLite file location:

`server/db/prism.sqlite`
