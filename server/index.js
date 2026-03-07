import { ApplicationsRepository } from "./repositories/applicationsRepository.js";
import { ApplicationDecisionsRepository } from "./repositories/applicationDecisionsRepository.js";
import { ApplicationReviewsRepository } from "./repositories/applicationReviewsRepository.js";
import { TimelineRepository } from "./repositories/timelineRepository.js";
import { ApplicationStudentSnapshotRepository } from "./repositories/applicationStudentSnapshotRepository.js";
import { ApplicationService } from "./services/applicationService.js";
import { ReviewService } from "./services/reviewService.js";
import { createSqliteClient } from "./db/sqliteClient.js";
import { initSchema, seedDemoData } from "./db/initSchema.js";

// Minimal composition root for V1. Wire HTTP handlers to these services.
export function createPrismServices(options = {}) {
    const db = createSqliteClient({ dbPath: options.dbPath });
    initSchema(db);
    if (options.seedDemoData) {
        seedDemoData(db);
    }

    const applicationsRepository = new ApplicationsRepository(db);
    const decisionsRepository = new ApplicationDecisionsRepository(db);
    const reviewsRepository = new ApplicationReviewsRepository(db);
    const timelineRepository = new TimelineRepository(db);
    const snapshotsRepository = new ApplicationStudentSnapshotRepository(db);

    const applicationService = new ApplicationService({
        db,
        applicationsRepository,
        snapshotsRepository,
        timelineRepository,
    });

    const reviewService = new ReviewService({
        applicationsRepository,
        decisionsRepository,
        reviewsRepository,
        timelineRepository,
    });

    return {
        db,
        repositories: {
            applicationsRepository,
            decisionsRepository,
            reviewsRepository,
            timelineRepository,
            snapshotsRepository,
        },
        services: {
            applicationService,
            reviewService,
        },
    };
}
