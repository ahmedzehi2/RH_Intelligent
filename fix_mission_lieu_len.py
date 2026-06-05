"""Migration : Augmenter la taille du champ lieu dans dbo.Mission"""
from backend.db import Database

db = Database()

sql = "ALTER TABLE dbo.Mission ALTER COLUMN lieu NVARCHAR(500) NULL"

try:
    db.execute(sql)
    print("[OK] Champ 'lieu' augmenté à 500 caractères.")
except Exception as e:
    print(f"[ERR] {e}")

print("\nMigration terminée.")
