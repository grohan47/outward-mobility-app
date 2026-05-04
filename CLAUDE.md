# outward-mobility-app

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills:
- `/office-hours` — YC-style forcing questions for demand reality
- `/plan-ceo-review` — CEO/founder-mode plan review
- `/plan-eng-review` — Eng manager-mode plan review
- `/plan-design-review` — Designer's eye plan review
- `/design-consultation` — Understand product, research landscape, propose design
- `/design-shotgun` — Generate multiple AI design variants
- `/design-html` — Generate production-quality HTML/CSS
- `/review` — Pre-landing PR review
- `/ship` — Ship workflow: merge, test, bump version, update changelog
- `/land-and-deploy` — Merge PR, wait for CI/deploy, verify production health
- `/canary` — Post-deploy canary monitoring
- `/benchmark` — Performance regression detection
- `/browse` — Fast headless browser for QA testing and dogfooding
- `/connect-chrome` — Connect to Chrome browser
- `/qa` — Systematically QA test a web app and fix bugs
- `/qa-only` — Report-only QA testing
- `/design-review` — Designer's eye QA
- `/setup-browser-cookies` — Import cookies from real Chromium browser
- `/setup-deploy` — Configure deployment settings
- `/setup-gbrain` — Set up gbrain for coding agent
- `/retro` — Weekly engineering retrospective
- `/investigate` — Systematic debugging with root cause investigation
- `/document-release` — Post-ship documentation update
- `/codex` — OpenAI Codex CLI wrapper
- `/cso` — Chief Security Officer mode security audit
- `/autoplan` — Auto-review pipeline
- `/plan-devex-review` — Developer experience plan review
- `/devex-review` — Live developer experience audit
- `/careful` — Safety guardrails for destructive commands
- `/freeze` — Restrict file edits to a specific directory
- `/guard` — Full safety mode
- `/unfreeze` — Clear freeze boundary
- `/gstack-upgrade` — Upgrade gstack to latest version
- `/learn` — Manage project learnings

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
