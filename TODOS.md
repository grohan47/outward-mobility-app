# TODOs

## P1: Migration proof harness after graph-only demo slice

**What:** Add an automated migration proof harness for graph-only migration after the first AI-native demo slice.

**Why:** Destructive graph migration without a backup/proof harness is accepted for demo speed, but it remains the highest data-risk decision before real use.

**Pros:** Proves seeded opportunities, submissions, reviewer inboxes, request changes, approvals, and final status survive graph migration before real deployment.

**Cons:** Adds migration/test work that does not directly improve the first visible AI workflow.

**Context:** This was D2/D18 in `/plan-eng-review`. The user accepted proceeding with destructive graph migration only for the first slice. The follow-up should create a repeatable migration check using seeded/demo data and existing lifecycle tests as the baseline. It should run before PRISM is used with real data.

**Effort:** M human team -> S with CC+gstack

**Depends on / blocked by:** First graph schema and `GraphExecutionService` must exist.

## P1: Focused demo polish lane after core AI workflow works

**What:** Add a focused demo polish pass after the AI intake, graph publish, and golden demo path are functional.

**Why:** The core AI workflow may be impressive but still feel unfinished if loading, empty, error, success, partial-generation states, seeded data, and copy are rough.

**Pros:** Improves trust in the VC/agentic AI demo, makes the product feel intentional, and protects the AI workflow from looking like a prototype.

**Cons:** Takes time away from graph depth and broader AI hardening.

**Context:** This was D5 in the `/plan-ceo-review`. The decision was to defer dedicated polish while going head first into the AI-native workflow. Start with AI generation loading state, generated plan empty/error/success states, seeded OGA scenario, clear warnings, and final demo rehearsal copy.

**Effort:** M human team -> S with CC+gstack

**Depends on / blocked by:** Core AI intake, graph publish flow, and protected golden demo path must work first.

## P1: Full graph execution state-machine test matrix

**What:** Add full graph execution state-machine tests beyond the protected happy demo graph.

**Why:** The graph engine can make subtle wrong decisions: advancing before all approvals finish, accepting stale tasks, skipping conditional branches, allowing duplicate decisions, or failing when condition data is missing.

**Pros:** Gives confidence beyond the scripted demo and makes graph execution maintainable after the VC presentation.

**Cons:** Takes time after the first demo path and may expose design gaps that require refactor.

**Context:** This was D15 in the `/plan-ceo-review`. The accepted implementation scope only requires testing the happy demo graph initially. Follow-up should cover sequential, parallel, conditional, final authority, duplicate decision, stale task, join-not-ready, and condition-missing-field cases.

**Effort:** L human team -> M with CC+gstack

**Depends on / blocked by:** `GraphExecutionService` and first-class graph schema must exist first.

## P2: Named AI failure recovery states

**What:** Add named AI failure states and recovery actions for model-backed workflow generation, including fallback-used state.

**Why:** Model timeout, malformed JSON, refusal, invalid graph, fallback-used state, and missing required fields should not all look the same to admins.

**Pros:** Improves trust and makes AI failures debuggable by users and developers.

**Cons:** Adds UI/error mapping work across model, validator, and plan review flows.

**Context:** This was D11 in the `/plan-ceo-review` and D19 in `/plan-eng-review`. The accepted demo plan uses a generic error toast plus retry, while D15 adds timeout, retry-once, and deterministic fallback. Follow-up should expose named states like “generation timed out,” “draft failed validation,” “clarification needed,” “fallback draft available,” and “provider unavailable.”

**Effort:** M human team -> S with CC+gstack

**Depends on / blocked by:** AI draft service, validation pipeline, and generated plan review UI must exist first.

## P2: Stale draft publish protection

**What:** Add stale draft publish protection for AI-generated workflow drafts.

**Why:** An older AI draft can overwrite a newer clarified or edited workflow if multiple admins work on the same opportunity.

**Pros:** Prevents silent workflow overwrites and makes publish behavior trustworthy.

**Cons:** Requires draft versioning/conflict UI and tests.

**Context:** This was D13 in the `/plan-ceo-review` and D20 in `/plan-eng-review`. Accepted demo behavior is last publish wins. D4/D6 add persisted `workflow_drafts`, explicit publish, and clarification Q&A, which makes stale draft overwrite a clearer future correctness gap. Follow-up should add a version check and show: “This draft changed. Review the latest version before publishing.”

**Effort:** M human team -> S with CC+gstack

**Depends on / blocked by:** `workflow_drafts`, draft graph versioning, clarification persistence, and admin publish flow must be implemented first.

## P2: Create DESIGN.md — token library and component vocabulary

**What:** Create a `DESIGN.md` at the repo root documenting the PRISM design system: color tokens (with Tailwind class mappings), spacing scale, typography scale, component vocabulary (node cards, SLA chips, inspector layout, mode switcher, AI panel), and icon usage conventions.

**Why:** The Opportunity Studio introduced ~15 new design tokens (node colors, SLA chip states, graph canvas background, inspector patterns). Without a documented design system, Lane F and future UI screens will diverge visually and require costly reconciliation.

**Pros:** Ensures Lane F's SLA dashboard, admin breach UI, and reviewer task cards follow the same visual vocabulary as the Opportunity Studio. Makes `/design-review` and `/plan-design-review` faster on future chunks.

**Cons:** Takes time away from feature work; design systems can become stale if not maintained.

**Context:** Flagged in `/plan-design-review` for Chunk 7 (2026-05-05). No DESIGN.md currently exists. The token spec is documented inline in the Chunk 7 design section of the CEO plan — this TODO is to extract it into a canonical reference file.

**Effort:** S human team -> XS with CC+gstack

**Depends on / blocked by:** Chunk 7 implementation must be complete so the actual rendered tokens can be confirmed against the spec.

## P2: React Flow keyboard navigation accessibility audit

**What:** After Chunk 7 ships, audit the React Flow graph canvas keyboard navigation: Tab/arrow key navigation between nodes, Enter to select, Escape to deselect, Ctrl+Z/Y undo/redo, and screen reader announcements for node state changes.

**Why:** React Flow's default keyboard behavior doesn't meet WCAG 2.1 AA for keyboard-only and screen-reader users out of the box. Custom node types (ReviewerNode, ForkMergeNode) need explicit `aria-label` and `role` attributes. The spec is written, but implementation gaps only show in real browser testing.

**Pros:** Makes the Opportunity Studio accessible to admin users who rely on keyboard navigation. Required for institutional/university software purchasing.

**Cons:** React Flow a11y customization is non-trivial; may require wrapping node event handlers.

**Context:** Flagged in `/plan-design-review` for Chunk 7 (2026-05-05). Keyboard nav spec is written in the Chunk 7 design section. Audit should use VoiceOver (macOS) or NVDA (Windows) and the standard keyboard nav test checklist.

**Effort:** S human team -> S with CC+gstack

**Depends on / blocked by:** Chunk 7 React Flow implementation must be complete.
