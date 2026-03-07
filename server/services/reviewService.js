import { getUpdatedApplicationState } from "./workflowService.js";

export class ReviewService {
    constructor({ applicationsRepository, decisionsRepository, reviewsRepository, timelineRepository }) {
        this.applicationsRepository = applicationsRepository;
        this.decisionsRepository = decisionsRepository;
        this.reviewsRepository = reviewsRepository;
        this.timelineRepository = timelineRepository;
    }

    submitReview({ applicationId, reviewerUserId, reviewerRole, decision, remarks, visibilityScope = "INTERNAL" }) {
        const application = this.applicationsRepository.findById(applicationId);
        if (!application) {
            throw new Error("Application not found.");
        }

        const now = new Date().toISOString();

        this.reviewsRepository.create({
            application_id: application.id,
            review_role: reviewerRole,
            verification_outcome: decision,
            remarks,
            visibility_scope: visibilityScope,
            created_by: reviewerUserId,
            created_at: now,
        });

        this.decisionsRepository.create({
            application_id: application.id,
            stage_code: application.current_stage,
            decision,
            reason: remarks,
            decided_by: reviewerUserId,
            decided_at: now,
        });

        const nextState = getUpdatedApplicationState({
            application,
            decision,
            actorRole: reviewerRole,
        });

        this.applicationsRepository.update(application.id, {
            ...nextState,
            updated_at: now,
        });

        this.timelineRepository.create({
            application_id: application.id,
            event_type: "DECISION_RECORDED",
            event_payload: {
                decision,
                from_stage: application.current_stage,
                to_stage: nextState.current_stage,
                final_status: nextState.final_status,
            },
            actor_user_id: reviewerUserId,
            created_at: now,
        });

        return this.applicationsRepository.findById(application.id);
    }
}
