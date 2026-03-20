// Repository for application remarks/comments
import { TABLES } from '../db/tableCatalog.js';

export class ApplicationRemarksRepository {
    constructor(db) {
        this.db = db;
    }

    // Create a new remark
    create({ application_id, remark_type, text, visibility_scope, created_by, created_at }) {
        return this.db.run(
            `INSERT INTO ${TABLES.APPLICATION_REMARKS} (application_id, remark_type, text, visibility_scope, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [application_id, remark_type, text, visibility_scope, created_by, created_at]
        );
    }

    // Get all remarks for an application
    findByApplicationId(application_id) {
        return this.db.all(
            `SELECT * FROM ${TABLES.APPLICATION_REMARKS} WHERE application_id = ? ORDER BY created_at ASC`,
            [application_id]
        );
    }
}
