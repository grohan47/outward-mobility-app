export const STAGES = Object.freeze({
    STUDENT_SUBMISSION: "STUDENT_SUBMISSION",
    UG_ACADEMICS: "UG_ACADEMICS",
    STUDENT_LIFE: "STUDENT_LIFE",
    PROGRAM_CHAIR: "PROGRAM_CHAIR",
    OGE: "OGE",
    DEAN: "DEAN",
    CLOSED: "CLOSED",
});

// Fixed sequence for V1. Keep all stage movement in workflowService.
export const STAGE_ORDER = Object.freeze([
    STAGES.STUDENT_SUBMISSION,
    STAGES.UG_ACADEMICS,
    STAGES.STUDENT_LIFE,
    STAGES.PROGRAM_CHAIR,
    STAGES.OGE,
    STAGES.DEAN,
]);

export const DECISIONS = Object.freeze({
    APPROVE: "APPROVE",
    FLAG: "FLAG",
    REJECT: "REJECT",
    WITHDRAW: "WITHDRAW",
});

export function getNextStage(stage) {
    const index = STAGE_ORDER.indexOf(stage);
    if (index === -1 || index === STAGE_ORDER.length - 1) {
        return STAGES.CLOSED;
    }
    return STAGE_ORDER[index + 1];
}
