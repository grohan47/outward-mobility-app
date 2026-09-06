"""Explicit development database lifecycle; never called during HTTP requests."""

import argparse
from pathlib import Path
from fastapi_app import main


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["init", "reset"])
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    path = main.DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    if args.command == "reset":
        for suffix in ["", "-wal", "-shm"]:
            Path(str(path) + suffix).unlink(missing_ok=True)
    if path.exists():
        main.ensure_db_initialized()
        print("Database already initialized.")
        return
    with main.db_conn() as db:
        db.execute("PRAGMA journal_mode=WAL")
        main.reset_schema(db)
        if args.demo:
            main.seed_data(db)
        db.commit()
    print(f"Initialized {path}")


if __name__ == "__main__":
    run()
