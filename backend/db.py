# backend/db.py

import pyodbc
from backend import config
from contextlib import contextmanager

class Database:
    def __init__(self):
        self.conn = None

    def _connect(self):
        if self.conn is None:
            conn_parts = [
                f"DRIVER={{{config.DB_DRIVER}}}",
                f"SERVER={config.DB_SERVER}",
                f"DATABASE={config.DB_DATABASE}",
            ]

            if config.DB_USE_TRUSTED_CONNECTION and not (config.DB_UID or config.DB_PWD):
                conn_parts.append("Trusted_Connection=yes")
            else:
                if config.DB_UID:
                    conn_parts.append(f"UID={config.DB_UID}")
                if config.DB_PWD:
                    conn_parts.append(f"PWD={config.DB_PWD}")

            conn_parts.append("Mars_Connection=yes")
            conn_string = ";".join(conn_parts) + ";"
            self.conn = pyodbc.connect(conn_string, autocommit=True)

    @contextmanager
    def get_cursor(self):
        self._connect()
        cursor = self.conn.cursor()
        try:
            yield cursor
        finally:
            cursor.close()

    def fetch_one(self, query, params=None):
        with self.get_cursor() as cur:
            cur.execute(query, params or [])
            row = cur.fetchone()
            if not row:
                return None
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))

    def fetch_all(self, query, params=None):
        with self.get_cursor() as cur:
            cur.execute(query, params or [])
            rows = cur.fetchall()
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, r)) for r in rows]

    def execute(self, query, params=None):
        with self.get_cursor() as cur:
            cur.execute(query, params or [])
            return True

    def execute_and_identity(self, query, params=None):
        with self.get_cursor() as cur:
            cur.execute(query, params or [])
            cur.execute("SELECT @@IDENTITY AS id;")
            row = cur.fetchone()
            return int(row[0]) if row and row[0] is not None else None

    def close(self):
        if self.conn is not None:
            self.conn.close()
            self.conn = None