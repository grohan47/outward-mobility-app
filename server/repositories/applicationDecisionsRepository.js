export class ApplicationDecisionsRepository {
    constructor(db) {
        this.db = db;
    }

    findByApplicationId(applicationId) {
        return this.db
            .prepare(`SELECT * FROM application_decisions WHERE application_id = ? ORDER BY id ASC`)
            .all(applicationId);
    }

    create(payload) {
        const stmt = this.db.prepare(
            `INSERT INTO application_decisions (application_id, stage_code, decision, reason, decided_by, decided_at)
             VALUES (@application_id, @stage_code, @decision, @reason, @decided_by, @decided_at)`
        );
        const result = stmt.run(payload);
        return this.db.prepare(`SELECT * FROM application_decisions WHERE id = ?`).get(result.lastInsertRowid);
    }
}
