export class TimelineRepository {
    constructor(db) {
        this.db = db;
    }

    findByApplicationId(applicationId) {
        const rows = this.db
            .prepare(`SELECT * FROM timeline_events WHERE application_id = ? ORDER BY id ASC`)
            .all(applicationId);

        return rows.map((row) => ({
            ...row,
            event_payload: row.event_payload ? JSON.parse(row.event_payload) : null,
        }));
    }

    create(payload) {
        const dbPayload = {
            ...payload,
            event_payload: payload.event_payload ? JSON.stringify(payload.event_payload) : null,
        };
        const stmt = this.db.prepare(
            `INSERT INTO timeline_events (application_id, event_type, event_payload, actor_user_id, created_at)
             VALUES (@application_id, @event_type, @event_payload, @actor_user_id, @created_at)`
        );
        const result = stmt.run(dbPayload);
        const row = this.db.prepare(`SELECT * FROM timeline_events WHERE id = ?`).get(result.lastInsertRowid);
        return {
            ...row,
            event_payload: row.event_payload ? JSON.parse(row.event_payload) : null,
        };
    }
}
