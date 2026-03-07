import path from "node:path";
import Database from "better-sqlite3";

export function createSqliteClient(options = {}) {
    const dbPath = options.dbPath ?? path.resolve(process.cwd(), "server", "db", "prism.sqlite");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return db;
}
