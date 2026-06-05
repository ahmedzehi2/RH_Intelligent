"""Migration : ajout des champs géolocalisation dans dbo.Mission"""
from backend.db import Database

db = Database()

steps = [
    "ALTER TABLE dbo.Mission ADD latitude  FLOAT NULL",
    "ALTER TABLE dbo.Mission ADD longitude FLOAT NULL",
    "ALTER TABLE dbo.Mission ADD adresse   NVARCHAR(500) NULL",
]

for sql in steps:
    try:
        db.execute(sql)
        print(f"[OK]   {sql}")
    except Exception as e:
        err = str(e)
        if any(x in err for x in ["already", "2705", "21S21", "duplicate", "Duplicate"]):
            print(f"[SKIP] Colonne déjà présente : {sql}")
        else:
            print(f"[ERR]  {err}")

print("\nMigration Mission terminée.")
