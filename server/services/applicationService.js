import { STAGES } from "../config/workflow.js";

export class ApplicationService {
    constructor({ db, applicationsRepository, snapshotsRepository, timelineRepository }) {
        this.db = db;
        this.applicationsRepository = applicationsRepository;
        this.snapshotsRepository = snapshotsRepository;
        this.timelineRepository = timelineRepository;
    }

    createApplication({ studentProfileId, opportunityId }) {
        const now = new Date().toISOString();
        const application = this.applicationsRepository.create({
            student_profile_id: studentProfileId,
            opportunity_id: opportunityId,
            current_stage: STAGES.UG_ACADEMICS,
            final_status: null,
            created_at: now,
            updated_at: now,
        });

        const profile = this.db
            .prepare(`SELECT * FROM student_profiles WHERE id = ?`)
            .get(studentProfileId);

        this.snapshotsRepository.create({
            application_id: application.id,
            official_cgpa_at_submission: profile?.official_cgpa ?? null,
            program_at_submission: profile?.program ?? null,
            disciplinary_status_at_submission: null,
            snapshot_captured_at: now,
        });

        this.timelineRepository.create({
            application_id: application.id,
            event_type: "APPLICATION_CREATED",
            event_payload: { current_stage: application.current_stage },
            actor_user_id: null,
            created_at: now,
        });

        return application;
    }

    withdrawApplication({ applicationId, actorUserId = null }) {
        const existing = this.applicationsRepository.findById(applicationId);
        if (!existing) {
            throw new Error("Application not found.");
        }
        if (existing.final_status) {
            throw new Error("Only active applications can be withdrawn.");
        }

        const now = new Date().toISOString();
        const updated = this.applicationsRepository.update(applicationId, {
            current_stage: STAGES.CLOSED,
            final_status: "WITHDRAWN",
            updated_at: now,
        });

        this.timelineRepository.create({
            application_id: applicationId,
            event_type: "APPLICATION_WITHDRAWN",
            event_payload: {
                from_stage: existing.current_stage,
                to_stage: STAGES.CLOSED,
                final_status: "WITHDRAWN",
            },
            actor_user_id: actorUserId,
            created_at: now,
        });

        return updated;
    }
}
