export class ApplicationReviewsRepository {
    constructor(db) {
        this.db = db;
    }

    findByApplicationId(applicationId) {
        return this.db
            .prepare(`SELECT * FROM application_reviews WHERE application_id = ? ORDER BY id ASC`)
            .all(applicationId);
    }

    create(payload) {
        const stmt = this.db.prepare(
            `INSERT INTO application_reviews (application_id, review_role, verification_outcome, remarks, visibility_scope, created_by, created_at)
             VALUES (@application_id, @review_role, @verification_outcome, @remarks, @visibility_scope, @created_by, @created_at)`
        );
        const result = stmt.run(payload);
        return this.db.prepare(`SELECT * FROM application_reviews WHERE id = ?`).get(result.lastInsertRowid);
    }
}
