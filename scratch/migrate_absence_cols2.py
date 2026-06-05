"""
Complete migration - add remaining columns
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.db import Database

db = Database()

# Add remaining columns
migrations = [
    ("commentaire_rh",   "ALTER TABLE dbo.Absence ADD commentaire_rh NVARCHAR(500) NULL"),
    ("traite_par_admin", "ALTER TABLE dbo.Absence ADD traite_par_admin INT NULL"),
    ("date_traitement",  "ALTER TABLE dbo.Absence ADD date_traitement DATETIME NULL"),
]

cols = db.fetch_all(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
    "WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Absence'"
)
existing = {c['COLUMN_NAME'] for c in cols}

for col_name, sql in migrations:
    if col_name not in existing:
        try:
            db.execute(sql)
            print("OK:", col_name)
        except Exception as e:
            print("ERR:", col_name, str(e))
    else:
        print("SKIP:", col_name)

# Sync existing absences
try:
    db.execute(
        "UPDATE dbo.Absence SET justification_statut = 'EN_ATTENTE' "
        "WHERE justification_statut IS NULL"
    )
    print("Sync done")
except Exception as e:
    print("Sync ERR:", str(e))

print("Done")
