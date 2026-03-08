import { STAGES } from "../config/workflow.js";

const EVENT_TYPES = Object.freeze({
    APPLICATION_CREATED: "APPLICATION_CREATED",
    APPLICATION_RESUBMITTED: "APPLICATION_RESUBMITTED",
});

export class ApplicationService {
    constructor({ db, applicationsRepository, snapshotsRepository, timelineRepository }) {
        this.db = db;
        this.applicationsRepository = applicationsRepository;
        this.snapshotsRepository = snapshotsRepository;
        this.timelineRepository = timelineRepository;
    }

    getNowIso() {
        return new Date().toISOString();
    }

    getStudentProfile(studentProfileId) {
        return this.db.prepare("SELECT * FROM student_profiles WHERE id = ?").get(studentProfileId);
    }

    createApplication({ studentProfileId, opportunityId }) {
        const now = this.getNowIso();
        const application = this.applicationsRepository.create({
            student_profile_id: studentProfileId,
            opportunity_id: opportunityId,
            current_stage: STAGES.STUDENT_LIFE,
            final_status: null,
            created_at: now,
            updated_at: now,
        });

        const profile = this.getStudentProfile(studentProfileId);

        this.snapshotsRepository.create({
            application_id: application.id,
            official_cgpa_at_submission: profile?.official_cgpa ?? null,
            program_at_submission: profile?.program ?? null,
            disciplinary_status_at_submission: null,
            snapshot_captured_at: now,
        });

        this.timelineRepository.create({
            application_id: application.id,
            event_type: EVENT_TYPES.APPLICATION_CREATED,
            event_payload: { current_stage: application.current_stage },
            actor_user_id: null,
            created_at: now,
        });

        return application;
    }

    resubmitApplication({ applicationId, actorUserId = null }) {
        const existing = this.applicationsRepository.findById(applicationId);
        if (!existing) {
            throw new Error("Application not found.");
        }
        if (existing.final_status) {
            throw new Error("Closed applications cannot be resubmitted.");
        }
        if (existing.current_stage !== STAGES.STUDENT_SUBMISSION) {
            throw new Error("Only applications flagged back to Student can be resubmitted.");
        }

        const now = this.getNowIso();
        const updated = this.applicationsRepository.update(applicationId, {
            current_stage: STAGES.STUDENT_LIFE,
            updated_at: now,
        });

        this.timelineRepository.create({
            application_id: applicationId,
            event_type: EVENT_TYPES.APPLICATION_RESUBMITTED,
            event_payload: {
                from_stage: STAGES.STUDENT_SUBMISSION,
                to_stage: STAGES.STUDENT_LIFE,
            },
            actor_user_id: actorUserId,
            created_at: now,
        });

        return updated;
    }
}
