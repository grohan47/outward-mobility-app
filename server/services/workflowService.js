import { DECISIONS, getNextStage, STAGES } from "../config/workflow.js";
import { canReject } from "./accessService.js";

export function getUpdatedApplicationState({ application, decision, actorRole }) {
    if (decision === DECISIONS.REJECT) {
        if (!canReject(actorRole)) {
            throw new Error("Only OGE Admin or Dean can reject an application.");
        }
        return {
            current_stage: STAGES.CLOSED,
            final_status: "REJECTED",
        };
    }

    if (decision === DECISIONS.FLAG) {
        return {
            current_stage: STAGES.OGE,
            final_status: null,
        };
    }

    if (decision === DECISIONS.APPROVE) {
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

    if (decision === DECISIONS.WITHDRAW) {
        return {
            current_stage: STAGES.CLOSED,
            final_status: "WITHDRAWN",
        };
    }

    throw new Error(`Unsupported decision: ${decision}`);
}
