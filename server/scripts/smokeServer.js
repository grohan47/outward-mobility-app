import { createPrismServices } from "../index.js";

const app = createPrismServices({ seedDemoData: true });

const created = app.services.applicationService.createApplication({
    studentProfileId: 1,
    opportunityId: 1,
});

const updated = app.services.reviewService.submitReview({
    applicationId: created.id,
    reviewerUserId: 99,
    reviewerRole: "UG_ACADEMICS",
    decision: "APPROVE",
    remarks: "Verified and approved.",
});

console.log("server-smoke-ok", { id: updated.id, stage: updated.current_stage, finalStatus: updated.final_status });
