import express from "express";
import { createPrismServices } from "./index.js";

const PORT = Number(process.env.PORT || 8787);
const app = express();
app.use(express.json());

const prism = createPrismServices({ seedDemoData: true });
const { db } = prism;

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function withErrorHandling(handler) {
    return (req, res, next) => {
        try {
            handler(req, res, next);
        } catch (error) {
            next(error);
        }
    };
}

function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

const STAGE_LABELS = Object.freeze({
    STUDENT_SUBMISSION: "Student Submission",
    STUDENT_LIFE: "Student Life Review",
    PROGRAM_CHAIR: "Program Chair Review",
    OGE: "OGE Office",
    DEAN: "Dean Academics Final Decision",
    CLOSED: "Closed",
});

const STAGE_STAKEHOLDER = Object.freeze({
    STUDENT_SUBMISSION: "Student",
    STUDENT_LIFE: "Student Life",
    PROGRAM_CHAIR: "Program Chair",
    OGE: "OGE Office",
    DEAN: "Dean of Academics",
    CLOSED: "Completed",
});

function normalizeUniversityName(name) {
    const value = String(name ?? "").trim();
    if (!value) {
        return "";
    }
    if (value.toLowerCase() === "stanford") {
        return "Stanford University";
    }
    return value;
}

function toCodeSeed(text) {
    return String(text)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 24);
}

function resolveOpportunityId({ opportunityId, universityName }) {
    if (opportunityId) {
        if (!isPositiveInteger(opportunityId)) {
            throw createHttpError(400, "opportunityId must be a positive integer.");
        }
        const existing = db.prepare(`SELECT id FROM opportunities WHERE id = ?`).get(opportunityId);
        if (!existing) {
            throw createHttpError(400, "Invalid opportunityId.");
        }
        return Number(opportunityId);
    }

    const normalizedUniversityName = normalizeUniversityName(universityName);
    if (!normalizedUniversityName) {
        throw createHttpError(400, "Select a target university before submitting.");
    }

    const found = db
        .prepare(`SELECT id FROM opportunities WHERE LOWER(destination) = LOWER(?) OR LOWER(title) LIKE LOWER(?) LIMIT 1`)
        .get(normalizedUniversityName, `%${normalizedUniversityName}%`);
    if (found?.id) {
        return Number(found.id);
    }

    const now = new Date();
    const code = `${toCodeSeed(normalizedUniversityName)}_${now.getFullYear()}`;
    const title = `${normalizedUniversityName} Exchange`;
    const term = `Auto-created ${now.getFullYear()}`;
    try {
        const insertResult = db
            .prepare(`INSERT INTO opportunities (code, title, term, destination) VALUES (?, ?, ?, ?)`)
            .run(code, title, term, normalizedUniversityName);
        return Number(insertResult.lastInsertRowid);
    } catch (_error) {
        const retryFound = db
            .prepare(`SELECT id FROM opportunities WHERE LOWER(destination) = LOWER(?) LIMIT 1`)
            .get(normalizedUniversityName);
        if (retryFound?.id) {
            return Number(retryFound.id);
        }
        throw createHttpError(409, "Could not create opportunity for selected university.");
    }
}

function getWorkflowMeta(application) {
    const stageCode = application.current_stage;
    return {
        stageCode,
        stageLabel: STAGE_LABELS[stageCode] ?? stageCode,
        currentStakeholder: application.final_status ? "Completed" : (STAGE_STAKEHOLDER[stageCode] ?? "Unknown"),
        finalStatus: application.final_status,
    };
}

// Seed one demo application the first time so frontend has data.
function ensureDemoApplication() {
    const countRow = db.prepare(`SELECT COUNT(*) AS count FROM applications`).get();
    if ((countRow?.count ?? 0) > 0) {
        return;
    }

    const created = prism.services.applicationService.createApplication({
        studentProfileId: 1,
        opportunityId: 1,
    });

    prism.services.reviewService.submitReview({
        applicationId: created.id,
        reviewerUserId: 99,
        reviewerRole: "STUDENT_LIFE",
        decision: "APPROVE",
        remarks: "Initial academic verification completed.",
    });
}

ensureDemoApplication();

app.get("/api/health", withErrorHandling((_req, res) => {
    res.json({ ok: true });
}));

app.get("/api/applications", withErrorHandling((req, res) => {
    const studentProfileId = req.query.studentProfileId ? Number(req.query.studentProfileId) : null;

    let rows;
    if (studentProfileId) {
        rows = prism.repositories.applicationsRepository.findByStudentProfileId(studentProfileId);
    } else {
        rows = prism.repositories.applicationsRepository.list();
    }

    const enriched = rows.map((row) => {
        const opportunity = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(row.opportunity_id);
        const profile = db.prepare(`SELECT * FROM student_profiles WHERE id = ?`).get(row.student_profile_id);
        const user = profile ? db.prepare(`SELECT * FROM users WHERE id = ?`).get(profile.user_id) : null;
        return {
            ...row,
            opportunity,
            student_profile: profile,
            student_user: user,
            workflow: getWorkflowMeta(row),
        };
    });

    res.json({ items: enriched });
}));

app.get("/api/applications/:id", withErrorHandling((req, res) => {
    const applicationId = Number(req.params.id);
    const application = prism.repositories.applicationsRepository.findById(applicationId);

    if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
    }

    const opportunity = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(application.opportunity_id);
    const profile = db.prepare(`SELECT * FROM student_profiles WHERE id = ?`).get(application.student_profile_id);
    const user = profile ? db.prepare(`SELECT * FROM users WHERE id = ?`).get(profile.user_id) : null;
    const reviews = prism.repositories.reviewsRepository.findByApplicationId(application.id);
    const decisions = prism.repositories.decisionsRepository.findByApplicationId(application.id);
    const timeline = prism.repositories.timelineRepository.findByApplicationId(application.id);
    const snapshot = prism.repositories.snapshotsRepository.findByApplicationId(application.id);

    res.json({
        application,
        opportunity,
        student_profile: profile,
        student_user: user,
        snapshot,
        reviews,
        decisions,
        timeline,
        workflow: getWorkflowMeta(application),
    });
}));

app.post("/api/applications", withErrorHandling((req, res) => {
    try {
        const { studentProfileId, opportunityId, universityName } = req.body;
        const parsedStudentProfileId = Number(studentProfileId);
        if (!isPositiveInteger(parsedStudentProfileId)) {
            throw createHttpError(400, "studentProfileId must be a positive integer.");
        }

        const studentProfile = db.prepare(`SELECT id FROM student_profiles WHERE id = ?`).get(parsedStudentProfileId);
        if (!studentProfile) {
            throw createHttpError(404, "studentProfileId not found.");
        }

        const parsedOpportunityId = opportunityId == null ? null : Number(opportunityId);

        const resolvedOpportunityId = resolveOpportunityId({
            opportunityId: parsedOpportunityId,
            universityName,
        });

        const created = prism.services.applicationService.createApplication({
            studentProfileId: parsedStudentProfileId,
            opportunityId: resolvedOpportunityId,
        });

        res.status(201).json({ application: created });
    } catch (error) {
        const status = Number(error?.status) || 500;
        res.status(status).json({ error: error?.message || "Failed to create application." });
    }
}));

app.post("/api/applications/:id/resubmit", withErrorHandling((req, res) => {
    try {
        const applicationId = Number(req.params.id);
        const actorUserId = req.body?.actorUserId ? Number(req.body.actorUserId) : null;
        const updated = prism.services.applicationService.resubmitApplication({
            applicationId,
            actorUserId,
        });
        res.json({ application: updated });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}));

app.post("/api/reviews/submit", withErrorHandling((req, res) => {
    try {
        const { applicationId, reviewerUserId, reviewerRole, decision, remarks, visibilityScope } = req.body;
        const updated = prism.services.reviewService.submitReview({
            applicationId: Number(applicationId),
            reviewerUserId: Number(reviewerUserId),
            reviewerRole,
            decision,
            remarks,
            visibilityScope,
        });

        res.json({ application: updated });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}));

app.use((error, _req, res, _next) => {
    const status = Number(error?.status) || 500;
    const message = error?.message || "Internal server error.";
    res.status(status).json({ error: message });
});

app.listen(PORT, () => {
    console.log(`prism-server-ready http://localhost:${PORT}`);
});
