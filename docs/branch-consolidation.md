# Branch consolidation — 6 September 2026

The selected starting history is `ai-rework` at `7dd37fb`, which includes the useful opportunity, AI draft, form, and graph foundation. The cleanup is consolidated onto `main`.

Each original remote branch tip is preserved as an annotated tag named `archive/2026-09-06/branches/<original-branch-name>`, including the old main. The obsolete branch pointers are removed only after main and the archive tags are pushed successfully.

| Original branch | Preserved commit | Disposition |
| --- | --- | --- |
| `ChatSystem` | `e5ade55d36be4cfb27d690dd171743c28918f356` | Archived divergent prototype |
| `Last-Code-Review-Feedback-MinorUpdates` | `e903a4e4ad4e3c1456b9581553f28e604a883f37` | Included in selected history |
| `Temp-agent-new-branch` | `641112318cd4d874253a70a290a9e861fddcb323` | Archived divergent prototype |
| `ai-rework` | `7dd37fb2d1c48da066222ddd1382788cd36d208b` | Included in selected history |
| `chat-thread-fix` | `ea3b9a88efde95d7494386bd0dc4be887872cc4f` | Archived divergent prototype |
| `codereview3` | `e903a4e4ad4e3c1456b9581553f28e604a883f37` | Included in selected history |
| `codex-chat-ui-updates` | `f5393a054f2b7dd8e596300119c874d64e5b6bb8` | Archived divergent prototype |
| `codex/add-custom-fields-to-opportunities` | `b2a73135aa85c80cdfc2af6348bfe303ad798f16` | Included in selected history |
| `codex/add-custom-fields-to-opportunities-fb18my` | `e00577a10297fd4b2155cb942100310abf0c73e4` | Included in selected history |
| `feat/ai-draft-service` | `0ffa2edda124714d81058bb292f228da96a1bb61` | Included in selected history |
| `feat/ai-plan-review-ui` | `da46d3acd1051cd0b1f0eb69ff3484a040cd697b` | Archived divergent prototype |
| `feat/graph-execution` | `853f7f30f69cba4fdb3dcc689eb936d4cb7590f4` | Included in selected history |
| `feat/graph-schema` | `ce1abb00788bae4d1c79b347132b9b77af6ca113` | Included in selected history |
| `general-product` | `4afde3a62079680c7e5d30c4703d89982fc613bf` | Included in selected history |
| `main` | `e903a4e4ad4e3c1456b9581553f28e604a883f37` | Included in selected history |
| `midsem` | `448b16606e6c0575ac5793e187ab0de45cf9f553` | Included in selected history |
| `opportunity-rework` | `448ee63a010b85f3baf4cec5f6edd8a9eac7570b` | Included in selected history |
| `review1` | `448b16606e6c0575ac5793e187ab0de45cf9f553` | Included in selected history |
| `svelte` | `f3ff80d935982341dca25bf6344ab39a975b30be` | Archived divergent prototype |

The divergent `ChatSystem` / `chat-thread-fix` work introduced a separate threaded messaging subsystem. Existing application comments are retained in the consolidated implementation; introducing a second messaging model would defeat the cleanup. `codex-chat-ui-updates` overlaps earlier messaging changes. `Temp-agent-new-branch` is an obsolete Vite/Gemini prototype, and `svelte` is an abandoned framework rewrite.

The divergent `feat/ai-plan-review-ui` tip adds V2 movable graph components, onboarding prototypes, conversational workflow work, and flag routing. The fixed-level editor and repeated-review semantics supersede its graph/flag implementation. Its conversational prototype remains recoverable for the future AI interaction task; duplicate V2 components and `to-be-integrated` copies are excluded from the working tree.

A full pre-consolidation Git bundle and branch inventory also remain outside this repository at `/home/rgcodes/Programming/outward-mobility-archive/2026-09-05/`. That archive includes a binary patch of the two pre-existing tracked Python bytecode changes. No source edits were discarded from the original worktree.

## Recovering an old branch

Fetch tags, then create a new branch from the archived tag. For example:

```bash
git fetch origin --tags
git switch -c codex/revisit-chat archive/2026-09-06/branches/ChatSystem
```

The local bundle can also restore a repository with `git clone /absolute/path/before-consolidation.bundle restored-repo`.

Consolidation preserves history, not a claim that the final implementation passed tests. Testing is explicitly deferred until the owner lifts the usage-related hold.
