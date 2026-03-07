import { DECISIONS, getNextStage, STAGES } from "../config/workflow.js";
import { canReject } from "./accessService.js";

const FLAG_ALLOWED_STAGES = new Set([
    STAGES.STUDENT_LIFE,
    STAGES.PROGRAM_CHAIR,
    STAGES.OGE,
]);

const REJECT_ALLOWED_STAGES = new Set([
    STAGES.OGE,
    STAGES.DEAN,
]);

const APPROVE_ALLOWED_STAGES = new Set([
    STAGES.STUDENT_LIFE,
    STAGES.PROGRAM_CHAIR,
    STAGES.OGE,
    STAGES.DEAN,
]);

export function getUpdatedApplicationState({ application, decision, actorRole }) {
    if (application.current_stage === STAGES.CLOSED || application.final_status) {
        throw new Error("Cannot change a closed application.");
    }

    if (decision === DECISIONS.REJECT) {
        if (!REJECT_ALLOWED_STAGES.has(application.current_stage)) {
            throw new Error("Reject is allowed only at OGE or Dean Academics stage.");
        }
        if (!canReject(actorRole)) {
            throw new Error("Only OGE Admin or Dean can reject an application.");
        }
        return {
            current_stage: STAGES.CLOSED,
            final_status: "REJECTED",
        };
    }

    if (decision === DECISIONS.FLAG) {
        if (!FLAG_ALLOWED_STAGES.has(application.current_stage)) {
            throw new Error("Flag is allowed only at Student Life, Program Chair, or OGE stage.");
        }
        return {
            current_stage: STAGES.STUDENT_SUBMISSION,
            final_status: null,
        };
    }

    if (decision === DECISIONS.APPROVE) {
        if (!APPROVE_ALLOWED_STAGES.has(application.current_stage)) {
            throw new Error("Approve is allowed only at Student Life, Program Chair, OGE, or Dean Academics stage.");
        }
        const nextStage = getNextStage(application.current_stage);
        if (nextStage === STAGES.CLOSED) {
            return {
                current_stage: STAGES.CLOSED,
                final_status: "APPROVED",
            };
        }
        return {
            current_stage: nextStage,
            final_status: null,
        };
    }

    throw new Error(`Unsupported decision: ${decision}`);
}
