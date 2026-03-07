import { getUpdatedApplicationState } from "./workflowService.js";
import { ROLES } from "../config/roles.js";
import { STAGES } from "../config/workflow.js";

const REVIEWER_ROLE_ALIASES = Object.freeze({
    OGE: ROLES.OGE_ADMIN,
    OGE_OFFICE: ROLES.OGE_ADMIN,
    DEAN: ROLES.DEAN_ACADEMICS,
    DEAN_FINAL_APPROVAL: ROLES.DEAN_ACADEMICS,
    DEAN_ACADEMICS: ROLES.DEAN_ACADEMICS,
    STUDENTLIFE: ROLES.STUDENT_LIFE,
    STUDENT_LIFE: ROLES.STUDENT_LIFE,
    CHAIR: ROLES.PROGRAM_CHAIR,
    PROGRAM_CHAIR_REVIEW: ROLES.PROGRAM_CHAIR,
});

const EXPECTED_REVIEWER_ROLE_BY_STAGE = Object.freeze({
    [STAGES.STUDENT_LIFE]: ROLES.STUDENT_LIFE,
    [STAGES.PROGRAM_CHAIR]: ROLES.PROGRAM_CHAIR,
    [STAGES.OGE]: ROLES.OGE_ADMIN,
    [STAGES.DEAN]: ROLES.DEAN_ACADEMICS,
});

function normalizeReviewerRole(reviewerRole) {
    if (!reviewerRole) {
        return reviewerRole;
    }
    return REVIEWER_ROLE_ALIASES[reviewerRole] ?? reviewerRole;
}

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

        const normalizedReviewerRole = normalizeReviewerRole(reviewerRole);
        const expectedReviewerRole = EXPECTED_REVIEWER_ROLE_BY_STAGE[application.current_stage];
        if (expectedReviewerRole && normalizedReviewerRole !== expectedReviewerRole) {
            throw new Error(
                `Stage ${application.current_stage} must be reviewed by ${expectedReviewerRole}; received ${reviewerRole}.`
            );
        }

        const now = new Date().toISOString();

        this.reviewsRepository.create({
            application_id: application.id,
            review_role: normalizedReviewerRole,
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
            actorRole: normalizedReviewerRole,
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
