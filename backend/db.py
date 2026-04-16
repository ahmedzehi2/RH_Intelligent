# backend/db.py

import pyodbc
from backend import config
from contextlib import contextmanager

class Database:
    def __init__(self):
        self.conn = pyodbc.connect(
            f"DRIVER={{{config.DB_DRIVER}}};"
            f"SERVER={config.DB_SERVER};"
            f"DATABASE={config.DB_DATABASE};"
            "Trusted_Connection=yes;"
            "Mars_Connection=yes;",
            autocommit=True
        )
        self.conn.setencoding("utf-8")

    @contextmanager
    def get_cursor(self):
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
        self.conn.close()