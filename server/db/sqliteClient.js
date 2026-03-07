import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDefaultDbPath() {
    // Resolve from source file location so backend works no matter which cwd launches Node.
    return path.resolve(__dirname, "prism.sqlite");
}

export function createSqliteClient(options = {}) {
    const dbPath = options.dbPath ?? getDefaultDbPath();
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    return db;
}
