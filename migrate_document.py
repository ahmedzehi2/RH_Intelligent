"""Migration : ajout des 6 nouveaux champs dans dbo.Document"""
from backend.db import Database

db = Database()

steps = [
    "ALTER TABLE dbo.Document ADD departement      NVARCHAR(100) NULL",
    "ALTER TABLE dbo.Document ADD sous_departement NVARCHAR(100) NULL",
    "ALTER TABLE dbo.Document ADD numero_telephone NVARCHAR(20)  NULL",
    "ALTER TABLE dbo.Document ADD langue           NVARCHAR(10)  NULL",
    "ALTER TABLE dbo.Document ADD nombre_copies    INT           NULL",
    "ALTER TABLE dbo.Document ADD motif            NVARCHAR(255) NULL",
    "UPDATE dbo.Document SET langue = 'FR', nombre_copies = 1 WHERE langue IS NULL",
]

for sql in steps:
    try:
        db.execute(sql)
        print(f"[OK]   {sql[:70]}")
    except Exception as e:
        err = str(e)
        # Ignorer si la colonne existe déjà (code SQL Server 2705 / 21S21)
        if any(x in err for x in ["already", "2705", "21S21", "duplicate", "Duplicate"]):
            print(f"[SKIP] Colonne déjà présente : {sql[:70]}")
        else:
            print(f"[ERR]  {err}")

print("\nMigration terminée.")
