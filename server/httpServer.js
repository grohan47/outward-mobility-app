import express from "express";
import { createPrismServices } from "./index.js";

const PORT = Number(process.env.PORT || 8787);
const app = express();
app.use(express.json());

const prism = createPrismServices({ seedDemoData: true });
const { db } = prism;

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
        reviewerRole: "UG_ACADEMICS",
        decision: "APPROVE",
        remarks: "Initial academic verification completed.",
    });
}

ensureDemoApplication();

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/applications", (req, res) => {
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
        };
    });

    res.json({ items: enriched });
});

app.get("/api/applications/:id", (req, res) => {
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
    });
});

app.post("/api/applications", (req, res) => {
    try {
        const { studentProfileId, opportunityId } = req.body;
        if (!studentProfileId || !opportunityId) {
            res.status(400).json({ error: "studentProfileId and opportunityId are required" });
            return;
        }

        const created = prism.services.applicationService.createApplication({
            studentProfileId: Number(studentProfileId),
            opportunityId: Number(opportunityId),
        });

        res.status(201).json({ application: created });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/applications/:id/withdraw", (req, res) => {
    try {
        const applicationId = Number(req.params.id);
        const actorUserId = req.body?.actorUserId ? Number(req.body.actorUserId) : null;
        const updated = prism.services.applicationService.withdrawApplication({
            applicationId,
            actorUserId,
        });
        res.json({ application: updated });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post("/api/reviews/submit", (req, res) => {
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
});

app.listen(PORT, () => {
    console.log(`prism-server-ready http://localhost:${PORT}`);
});
