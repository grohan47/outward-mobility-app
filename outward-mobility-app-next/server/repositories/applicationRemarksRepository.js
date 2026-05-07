// Repository for application remarks/comments
import { TABLES } from '../db/tableCatalog.js';

export class ApplicationRemarksRepository {
    constructor(db) {
        this.db = db;
    }

    create({ application_id, remark_type, text, visibility_scope, created_by, created_at }) {
        const stmt = this.db.prepare(
            `INSERT INTO ${TABLES.APPLICATION_REMARKS} (application_id, remark_type, text, visibility_scope, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
        );
        const result = stmt.run(
            application_id,
            remark_type,
            text,
            visibility_scope,
            created_by,
            created_at
        );
        return this.db.prepare(`SELECT * FROM ${TABLES.APPLICATION_REMARKS} WHERE id = ?`).get(result.lastInsertRowid);
    }

    findByApplicationId(application_id) {
        return this.db.prepare(
            `SELECT * FROM ${TABLES.APPLICATION_REMARKS} WHERE application_id = ? ORDER BY created_at ASC`,
        ).all(application_id);
    }
}
