export class ApplicationsRepository {
    constructor(db) {
        this.db = db;
    }

    list() {
        return this.db.prepare(`SELECT * FROM applications ORDER BY id DESC`).all();
    }

    findById(id) {
        return this.db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id) ?? null;
    }

    findByStudentProfileId(studentProfileId) {
        return this.db
            .prepare(`SELECT * FROM applications WHERE student_profile_id = ? ORDER BY id DESC`)
            .all(studentProfileId);
    }

    create(payload) {
        const stmt = this.db.prepare(
            `INSERT INTO applications (student_profile_id, opportunity_id, current_stage, final_status, created_at, updated_at)
             VALUES (@student_profile_id, @opportunity_id, @current_stage, @final_status, @created_at, @updated_at)`
        );
        const result = stmt.run(payload);
        return this.findById(result.lastInsertRowid);
    }

    update(id, patch) {
        const existing = this.findById(id);
        if (!existing) {
            return null;
        }
        const next = { ...existing, ...patch };
        this.db.prepare(
            `UPDATE applications
             SET student_profile_id = @student_profile_id,
                 opportunity_id = @opportunity_id,
                 current_stage = @current_stage,
                 final_status = @final_status,
                 created_at = @created_at,
                 updated_at = @updated_at
             WHERE id = @id`
        ).run(next);
        return this.findById(id);
    }
}
