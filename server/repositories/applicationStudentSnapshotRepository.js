export class ApplicationStudentSnapshotRepository {
    constructor(db) {
        this.db = db;
    }

    findByApplicationId(applicationId) {
        return this.db
            .prepare(`SELECT * FROM application_student_snapshot WHERE application_id = ?`)
            .get(applicationId) ?? null;
    }

    create(payload) {
        const stmt = this.db.prepare(
            `INSERT INTO application_student_snapshot (
                application_id,
                official_cgpa_at_submission,
                program_at_submission,
                disciplinary_status_at_submission,
                snapshot_captured_at
            ) VALUES (
                @application_id,
                @official_cgpa_at_submission,
                @program_at_submission,
                @disciplinary_status_at_submission,
                @snapshot_captured_at
            )`
        );
        stmt.run(payload);
        return this.findByApplicationId(payload.application_id);
    }
}
