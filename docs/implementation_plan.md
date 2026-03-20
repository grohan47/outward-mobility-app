# PRISM → Configurable Approvals Platform: Implementation Plan

## Goal

Transform the existing PRISM OGE-specific approvals prototype (React/Vite + Express/SQLite) into a **configurable, reusable approvals workflow platform** using Next.js + React + TypeScript. The current OGE flow becomes a seeded template. The system revolves around the **Application** as the central entity. **70%+ of non-AI endpoints must be implemented for midsem.**

> [!IMPORTANT]
> This is **not a greenfield rewrite**. We preserve existing UI visual language (Tailwind design tokens, card patterns, spacing, colors) and build on top of the working backend services. The existing OGE workflow must remain fully demoable.

---

## Phase 1 Audit Results

### Screen Inventory & Reuse Matrix

| Screen | Lines | API-Connected? | Reusable? | Disposition |
|--------|-------|----------------|-----------|-------------|
| [StudentDashboard](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/StudentDashboard.jsx#4-177) | 177 | No (hardcoded data) | **Partially** — card patterns & opportunity sidebar reusable | **Refactor**: connect to API, extract cards into components |
| [StudentApplicationForm](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/StudentApplicationForm.jsx#44-527) | 526 | Yes (POST `/api/applications`) | **Yes** — section-based form is very reusable | **Preserve & generalize**: make form sections data-driven |
| [StudentApplicationsList](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/StudentApplicationsList.jsx#18-178) | 177 | Yes (GET `/api/applications`) | **Yes** — timeline + history pattern reusable | **Preserve**: connect to new endpoints |
| [StudentMessages](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/StudentMessages.jsx#3-90) | 89 | No (static) | **Template only** — keep as WIP placeholder | **Keep as placeholder** |
| [OGEMasterDashboard](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/OGEMasterDashboard.jsx#16-175) | 175 | Yes (GET `/api/applications`) | **Yes** — table + filters reusable for admin | **Preserve & generalize** |
| [OGEApplicationReview](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/OGEApplicationReview.jsx#12-329) | 328 | Yes (GET+POST) | **Partially** — good section nav, but OGE-specific cards | **Refactor into generic reviewer** |
| [OGECreateOpportunity](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/OGECreateOpportunity.jsx#12-129) | 129 | No (frontend-only) | **Yes** — form pattern reusable | **Wire to API** |
| [ProgramChairTaskInbox](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/ProgramChairTaskInbox.jsx#49-188) | 188 | Yes (GET `/api/applications`) | **Yes** — inbox table pattern reusable | **Merge into generic reviewer inbox** |
| [ProgramChairReview](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/ProgramChairReview.jsx#4-274) | 274 | No (fully static) | **Template** — visual patterns good, no data | **Replace with generic reviewer** |
| [StudentLifeTaskInbox](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/StudentLifeTaskInbox.jsx#50-217) | 217 | Yes (GET `/api/applications`) | **Yes** — inbox table with SLA chips | **Merge into generic reviewer inbox** |
| [StudentLifeReview](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/StudentLifeReview.jsx#4-203) | 203 | No (fully static) | **Template** — conduct cards are domain-specific | **Replace with generic reviewer** |
| [DeanFinalApproval](file:///home/rgcodes/Programming/outward-mobility-app/src/screens/DeanFinalApproval.jsx#3-282) | 282 | No (fully static) | **Template** — consolidated review summary is great UI | **Replace with generic reviewer** |

**Key decision**: ProgramChairReview, StudentLifeReview, and DeanFinalApproval are **fully static** (no API integration). They will be replaced by a **single generic ReviewerApplicationView** that renders sections/cards based on the reviewer's visibility permissions. The visual patterns (progress bars, AI summary boxes, consolidated review summaries, action buttons) will be preserved as reusable components.

### Layout Inventory

| Layout | Has Header? | Has Sidebar? | Reusable? |
|--------|-------------|--------------|-----------|
| [StudentLayout](file:///home/rgcodes/Programming/outward-mobility-app/src/layouts/StudentLayout.jsx#5-20) | Yes (static heading) | Yes ([StudentSidebar](file:///home/rgcodes/Programming/outward-mobility-app/src/components/StudentSidebar.jsx#25-80)) | **Yes** — preserve |
| [OGELayout](file:///home/rgcodes/Programming/outward-mobility-app/src/layouts/OGELayout.jsx#20-145) | Yes (full nav+search) | Yes (sidebar with nav items) | **Yes** — adapt for Admin layout |
| [ProgramChairLayout](file:///home/rgcodes/Programming/outward-mobility-app/src/layouts/ProgramChairLayout.jsx#4-11) | No (passthrough) | No | **Replace** — screens had their own headers |
| [StudentLifeLayout](file:///home/rgcodes/Programming/outward-mobility-app/src/layouts/StudentLifeLayout.jsx#4-11) | No (passthrough) | No | **Replace** — screens had their own headers |

### Backend Inventory

**Implemented endpoints (6):**
1. `GET /api/health` ✅
2. `GET /api/applications` ✅ (lists all or filters by studentProfileId)
3. `GET /api/applications/:id` ✅ (full detail with reviews, timeline, etc.)
4. `POST /api/applications` ✅ (create from studentProfileId + opportunity)
5. `POST /api/applications/:id/resubmit` ✅
6. `POST /api/reviews/submit` ✅ (stage transition + decision recording)

**Database tables (13):** users, roles, user_roles, student_profiles, opportunities, workflow_stages, applications, application_student_snapshot, application_documents, application_reviews, application_decisions, application_remarks, timeline_events

**Services:** ApplicationService, ReviewService, WorkflowService, AccessService

---

## Proposed Changes

### Component 1: Next.js Project Initialization

#### [NEW] Next.js TypeScript application

Initialize a Next.js 14+ project with App Router **within the existing project directory**, preserving the existing `server/` directory.

- Framework: Next.js v14+ with App Router
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS v3 (same version, same config tokens)
- Font: Public Sans + Lexend (same as current)
- Preserve: `server/` directory as the Express backend layer (Next.js API routes will proxy or replaced incrementally)

**New folder structure:**
```
outward-mobility-app/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home / role selector (login)
│   ├── generator/                # Generator/Student surface
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard (opportunities + pending)
│   │   ├── applications/
│   │   │   ├── page.tsx          # My applications list
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Application detail/form
│   │   └── messages/
│   │       └── page.tsx          # Messages (WIP placeholder)
│   ├── reviewer/                 # Normalized reviewer surface
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Reviewer inbox (permission-filtered)
│   │   └── applications/
│   │       └── [id]/
│   │           └── page.tsx      # Generic review page
│   ├── admin/                    # Admin surface (OGE-like)
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Admin dashboard
│   │   ├── opportunities/
│   │   │   ├── page.tsx          # List/manage opportunities
│   │   │   └── new/
│   │   │       └── page.tsx      # Create opportunity
│   │   ├── applications/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Admin application view
│   │   ├── workflows/
│   │   │   └── page.tsx          # Workflow template management
│   │   └── form-templates/
│   │       └── page.tsx          # Form template management
│   └── api/                      # Next.js API routes
│       ├── health/route.ts
│       ├── opportunities/
│       │   ├── route.ts          # GET list, POST create
│       │   └── [id]/route.ts     # GET detail, PATCH update
│       ├── applications/
│       │   ├── route.ts          # GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts      # GET detail
│       │       ├── approve/route.ts
│       │       ├── request-changes/route.ts
│       │       ├── send-back-to-admin/route.ts
│       │       ├── reject-final/route.ts
│       │       ├── resubmit/route.ts
│       │       ├── comments/route.ts
│       │       └── deficiencies/route.ts
│       ├── my/
│       │   └── applications/
│       │       ├── route.ts
│       │       └── [id]/
│       │           ├── route.ts
│       │           ├── resubmit/route.ts
│       │           └── deficiencies/route.ts
│       ├── reviewer/
│       │   ├── inbox/route.ts
│       │   └── applications/
│       │       └── [id]/
│       │           ├── route.ts
│       │           ├── approve/route.ts
│       │           ├── request-changes/route.ts
│       │           ├── send-back-to-admin/route.ts
│       │           └── comments/route.ts
│       ├── admin/
│       │   ├── applications/
│       │   │   ├── route.ts
│       │   │   └── [id]/
│       │   │       ├── route.ts
│       │   │       ├── reject-final/route.ts
│       │   │       └── audit-log/route.ts
│       │   ├── dashboard/
│       │   │   └── summary/route.ts
│       │   ├── opportunities/
│       │   │   ├── route.ts
│       │   │   └── [id]/route.ts
│       │   ├── form-templates/
│       │   │   ├── route.ts
│       │   │   └── [id]/route.ts
│       │   ├── workflow-templates/
│       │   │   ├── route.ts
│       │   │   └── [id]/route.ts
│       │   └── visibility-preview/
│       │       └── [applicationId]/
│       │           └── [roleId]/route.ts
│       ├── uploads/route.ts
│       ├── users/
│       │   └── me/route.ts
│       ├── roles/route.ts
│       ├── workflows/
│       │   └── [id]/route.ts
│       └── ai/                   # Stubs
│           ├── validate-application/route.ts
│           ├── suggest-workflow/route.ts
│           └── summarize-application/route.ts
├── components/                   # Shared React components
│   ├── ui/                       # Base components
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Table.tsx
│   │   ├── ProgressBar.tsx
│   │   └── Modal.tsx
│   ├── layouts/
│   │   ├── GeneratorSidebar.tsx  # Derived from StudentSidebar
│   │   ├── AdminLayout.tsx       # Derived from OGELayout
│   │   ├── ReviewerLayout.tsx    # New normalized layout
│   │   └── AppHeader.tsx         # Shared header component
│   ├── application/              # Application-related components
│   │   ├── ApplicationCard.tsx
│   │   ├── ApplicationSection.tsx # Generic section renderer
│   │   ├── StepProgressBar.tsx
│   │   ├── TimelineView.tsx
│   │   └── DeficiencyCard.tsx
│   └── reviewer/
│       ├── ReviewerInbox.tsx     # Generic inbox table
│       ├── ReviewerActionBar.tsx # Approve/Flag/Reject/Comment bar
│       └── SectionCard.tsx       # Permission-filtered card
├── lib/                          # Shared utilities
│   ├── db/                       # Database (preserved from server/)
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   └── seed.ts
│   ├── services/                 # Business logic (preserved+extended)
│   │   ├── applicationService.ts
│   │   ├── reviewService.ts
│   │   ├── workflowService.ts
│   │   └── accessService.ts
│   ├── repositories/             # Data access
│   ├── types/                    # TypeScript types
│   │   ├── application.ts
│   │   ├── opportunity.ts
│   │   ├── reviewer.ts
│   │   └── workflow.ts
│   └── api-client.ts            # Client-side fetch wrapper
├── server/                       # Original Express server (kept for reference)
├── _react_prototype/             # Original Vite app (archived)
├── docs/
│   ├── CODE_REVIEW_READINESS.md
│   └── endpoint-progress-sheet.md # NEW
└── swagger/
    └── openapi.yaml             # NEW: OpenAPI spec
```

---

### Component 2: Normalized Data Model

#### [MODIFY] [schema.ts](file:///home/rgcodes/Programming/outward-mobility-app/lib/db/schema.ts)

Extend the existing 13-table schema with new tables for the generalized approvals engine:

**New tables to add:**
```sql
-- Form templates for dynamic form generation
CREATE TABLE IF NOT EXISTS form_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    schema_json TEXT NOT NULL,  -- JSON schema defining form fields
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Workflow templates defining sequential approval chains
CREATE TABLE IF NOT EXISTS workflow_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Steps within a workflow template
CREATE TABLE IF NOT EXISTS workflow_step_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_template_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id)
);

-- Reviewer assignments to workflow steps
CREATE TABLE IF NOT EXISTS reviewer_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_step_template_id INTEGER NOT NULL,
    reviewer_email TEXT NOT NULL,
    reviewer_display_name TEXT,
    access_level TEXT NOT NULL DEFAULT 'standard',
    allowed_actions TEXT NOT NULL DEFAULT '["approve","comment"]',
    visible_sections TEXT NOT NULL DEFAULT '["all"]',
    status TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY (workflow_step_template_id) REFERENCES workflow_step_templates(id)
);

-- Live workflow step instances per application
CREATE TABLE IF NOT EXISTS workflow_step_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    workflow_step_template_id INTEGER NOT NULL,
    assigned_reviewer_email TEXT,
    assigned_at TEXT,
    acted_at TEXT,
    decision TEXT,
    comment_summary TEXT,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (workflow_step_template_id) REFERENCES workflow_step_templates(id)
);

-- Deficiency items / clarification requests
CREATE TABLE IF NOT EXISTS deficiency_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    created_by_email TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id)
);

-- Comments with visibility scope
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    author_email TEXT NOT NULL,
    text TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'internal',
    created_at TEXT NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id)
);
```

**Modify existing `opportunities` table** to add references:
```sql
ALTER TABLE opportunities ADD COLUMN form_template_id INTEGER REFERENCES form_templates(id);
ALTER TABLE opportunities ADD COLUMN workflow_template_id INTEGER REFERENCES workflow_templates(id);
ALTER TABLE opportunities ADD COLUMN description TEXT;
ALTER TABLE opportunities ADD COLUMN deadline TEXT;
ALTER TABLE opportunities ADD COLUMN status TEXT DEFAULT 'published';
ALTER TABLE opportunities ADD COLUMN seats INTEGER;
ALTER TABLE opportunities ADD COLUMN created_at TEXT;
ALTER TABLE opportunities ADD COLUMN updated_at TEXT;
```

**Modify existing `applications` table** to add:
```sql
ALTER TABLE applications ADD COLUMN submitted_data TEXT;  -- JSON of form submission
ALTER TABLE applications ADD COLUMN current_step_id INTEGER;
ALTER TABLE applications ADD COLUMN submitted_at TEXT;
ALTER TABLE applications ADD COLUMN metadata TEXT;
```

---

### Component 3: API Endpoint Implementation

#### Non-AI endpoint inventory (must be ≥70% implemented):

| # | Endpoint | Method | Group | Priority |
|---|----------|--------|-------|----------|
| 1 | `/api/health` | GET | Utility | ✅ Done |
| 2 | `/api/opportunities` | GET | Generator | **P1** |
| 3 | `/api/opportunities/:id` | GET | Generator | **P1** |
| 4 | `/api/applications` | POST | Generator | ✅ Done |
| 5 | `/api/my/applications` | GET | Generator | **P1** |
| 6 | `/api/my/applications/:id` | GET | Generator | **P1** |
| 7 | `/api/my/applications/:id/resubmit` | PATCH | Generator | ✅ Done (adapt) |
| 8 | `/api/my/applications/:id/deficiencies` | GET | Generator | **P1** |
| 9 | `/api/reviewer/inbox` | GET | Reviewer | **P1** |
| 10 | `/api/reviewer/applications/:id` | GET | Reviewer | **P1** |
| 11 | `/api/reviewer/applications/:id/approve` | POST | Reviewer | **P1** |
| 12 | `/api/reviewer/applications/:id/request-changes` | POST | Reviewer | **P1** |
| 13 | `/api/reviewer/applications/:id/send-back-to-admin` | POST | Reviewer | **P2** |
| 14 | `/api/reviewer/applications/:id/comments` | POST | Reviewer | **P1** |
| 15 | `/api/admin/applications` | GET | Admin | **P1** |
| 16 | `/api/admin/applications/:id` | GET | Admin | **P1** |
| 17 | `/api/admin/dashboard/summary` | GET | Admin | **P1** |
| 18 | `/api/admin/opportunities` | POST | Admin | **P1** |
| 19 | `/api/admin/opportunities/:id` | PATCH | Admin | **P2** |
| 20 | `/api/admin/form-templates` | POST | Admin | **P2** |
| 21 | `/api/admin/form-templates/:id` | PATCH | Admin | **P2** |
| 22 | `/api/admin/workflow-templates` | POST | Admin | **P2** |
| 23 | `/api/admin/workflow-templates/:id` | PATCH | Admin | **P2** |
| 24 | `/api/admin/visibility-preview/:appId/:roleId` | GET | Admin | **P2** |
| 25 | `/api/admin/applications/:id/reject-final` | POST | Admin | **P1** |
| 26 | `/api/admin/audit-log/:applicationId` | GET | Admin | **P1** |
| 27 | `/api/uploads` | POST | Utility | **P2** |
| 28 | `/api/users/me` | GET | Utility | **P1** |
| 29 | `/api/roles` | GET | Utility | **P2** |
| 30 | `/api/workflows/:id` | GET | Utility | **P2** |
| 31 | `/api/ai/validate-application` | POST | AI Stub | **P3** |
| 32 | `/api/ai/suggest-workflow` | POST | AI Stub | **P3** |
| 33 | `/api/ai/summarize-application` | POST | AI Stub | **P3** |

**Target: 24/33 endpoints (73%) implemented as P1+P2.**

---

### Component 4: Normalized Reviewer UI

**What existed before:** 4 different reviewer screens (OGEApplicationReview, ProgramChairReview, StudentLifeReview, DeanFinalApproval) each with completely different headers, sidebars, card arrangements, and action buttons. Only OGEApplicationReview was API-connected.

**Why change:** Unsustainable to maintain one-off screens per reviewer role. The new system has N configurable reviewer roles — we need one generic screen that renders based on permissions.

**What is preserved:**
- Card/section styling (rounded-xl borders, shadow-sm, Tailwind color tokens)
- Section-nav sidebar pattern from OGEApplicationReview
- AI Insight banner pattern
- Consolidated review summary pattern from DeanFinalApproval
- Action button bar pattern (approve/flag/reject at bottom)
- SLA progress bar patterns
- Internal correspondence / comms panel (as WIP placeholder)

**What is normalized:**
- Single `ReviewerApplicationView` that receives:
  - `applicationData` (from API)
  - `visibleSections` (from reviewer assignment config)
  - `allowedActions` (from reviewer assignment config)
  - `accessLevel` (determines if final reject is shown)
- Sections rendered as `<SectionCard>` components: Personal Details, Academic Records, Discipline & Conduct, Program Fit/Course Alignment, Attachments, Reviewer Summary, Final Review
- Each card has `hidden | readonly | editable` state

---

### Component 5: Permission/Visibility Model

**Section/card-level visibility for MVP:**

| Section | UG Academics | Student Life | Program Chair | OGE | Dean |
|---------|-------------|--------------|---------------|-----|------|
| Personal Details | read-only | read-only | read-only | read-only | read-only |
| Academic Records | read-only | hidden | read-only | read-only | read-only |
| Discipline & Conduct | hidden | read-only | hidden | read-only | read-only |
| Program Fit / Courses | hidden | hidden | read-only | read-only | read-only |
| Attachments | read-only | read-only | read-only | read-only | read-only |
| Reviewer Summary | hidden | hidden | hidden | read-only | read-only |
| Final Review | hidden | hidden | hidden | hidden | read-only |

**Comment visibility scopes:** `internal`, `admin_only`, `generator_visible`

---

### Component 6: OGE Seeded Workflow Template

The existing OGE workflow is seeded as a **template configuration**:

```json
{
  "name": "OGE Outward Mobility Workflow",
  "steps": [
    { "order": 1, "name": "UG Academics Review", "reviewerEmail": "ug-academics@plaksha.edu.in" },
    { "order": 2, "name": "Student Life Review", "reviewerEmail": "student-life@plaksha.edu.in" },
    { "order": 3, "name": "Program Chair Review", "reviewerEmail": "program-chair@plaksha.edu.in" },
    { "order": 4, "name": "OGE Office Review", "reviewerEmail": "oge@plaksha.edu.in" },
    { "order": 5, "name": "Dean Academics Approval", "reviewerEmail": "dean@plaksha.edu.in" }
  ]
}
```

---

### Component 7: Documentation & Midsem Deliverables

#### [NEW] [endpoint-progress-sheet.md](file:///home/rgcodes/Programming/outward-mobility-app/docs/endpoint-progress-sheet.md)

Endpoint progress sheet with green/yellow/white status indicators for the professor.

#### [NEW] [openapi.yaml](file:///home/rgcodes/Programming/outward-mobility-app/swagger/openapi.yaml)

OpenAPI 3.0 specification for all endpoints.

---

## User Review Required

> [!WARNING]
> **Migration approach decision**: This plan proposes initializing Next.js within the **same project directory** and migrating incrementally. The existing `src/` Vite app and `server/` Express backend remain functional during migration. The alternative is creating a separate Next.js project and copying code over. Which approach do you prefer?

> [!IMPORTANT]
> **Tailwind CSS version**: The existing project uses TailwindCSS v3. The user requested Next.js but did *not* specify a Tailwind version. I will keep Tailwind v3 to preserve all existing class names. Confirm?

> [!IMPORTANT]
> **Auth model for MVP**: The current app has a frontend-only role selector (no real auth). I will implement a **simplified email-based identity middleware** using cookies/headers — the reviewer dashboard scope is determined by matching the logged-in email against `reviewer_assignments.reviewer_email`. Is this sufficient for midsem?

---

## Migration Plan (Safe Incremental Steps)

1. **Initialize Next.js alongside existing Vite** — keep `src/` and `server/` intact
2. **Port design system** — copy Tailwind config, global CSS, font links
3. **Port reusable components** — extract cards, badges, tables from existing screens into `components/`
4. **Build API routes** — implement endpoints in `app/api/`, backed by same SQLite + repositories
5. **Build Generator pages** — port StudentDashboard, StudentApplicationForm, StudentApplicationsList
6. **Build normalized Reviewer pages** — single inbox + single review page replacing 4 separate screens
7. **Build Admin pages** — port OGEMasterDashboard, OGECreateOpportunity, add monitoring
8. **Seed OGE workflow** — use DB seed scripts to create the template
9. **Add Swagger/OpenAPI** — via swagger-jsdoc or manual YAML
10. **Generate endpoint progress sheet** — color-coded status for professor
11. **Write test cases** — API endpoint tests

### Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing OGE demo flow | High | Keep `src/` and `server/` intact until Next.js version is fully functional |
| Loss of visual work from static screens | Medium | Extract visual patterns as reusable components BEFORE replacing screens |
| Database migration breaks seed data | High | Use `ALTER TABLE` with defaults, never drop columns |
| Too many endpoints for midsem timeline | Medium | Prioritize P1 endpoints first, stubs for P2/P3 |

---

## Verification Plan

### Automated Tests

1. **API endpoint tests** using a test runner (will create `__tests__/api/` directory):
   - Command: `npx jest --config jest.config.js` (or equivalent test runner)
   - Tests for each P1 endpoint: correct response codes, data shapes, error handling
   - Tests for workflow transitions: approve → next step, flag → back to student, reject → closed

2. **Database schema validation**:
   - Command: `node scripts/validateSchema.js`
   - Verify all tables exist, seed data loads correctly

3. **Build verification**:
   - Command: `npm run build` (Next.js production build must succeed)

### Manual Verification

1. **Demo flow walkthrough** (for the user to test):
   - Start the dev server: `npm run dev`
   - Open `http://localhost:3000`
   - Login as Student → see opportunities → submit application
   - Login as Reviewer → see inbox → open application → approve
   - Login as Admin → see dashboard → view all applications
   - Verify the OGE seeded workflow moves application through all 5 stages

2. **Swagger UI verification**:
   - Navigate to the Swagger UI endpoint
   - Verify all documented endpoints are listed
   - Test at least 3 endpoints via Swagger UI

3. **Endpoint progress sheet review**:
   - Open `docs/endpoint-progress-sheet.md`
   - Verify green/yellow/white status matches actual implementation state
