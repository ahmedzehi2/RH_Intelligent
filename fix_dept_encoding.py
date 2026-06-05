"""
Migration : Conversion forcée de Departement.nom_departement en NVARCHAR.
On doit supprimer l'index, convertir, puis recréer l'index.
"""
from backend.db import Database

db = Database()

steps = [
    # 1. Supprimer l'index dépendant
    "DROP INDEX IX_Departement_Nom ON dbo.Departement",
    # 2. Convertir la colonne
    "ALTER TABLE dbo.Departement ALTER COLUMN nom_departement NVARCHAR(100) NULL",
    # 3. Recréer l'index
    "CREATE INDEX IX_Departement_Nom ON dbo.Departement(nom_departement)"
]

for sql in steps:
    try:
        db.execute(sql)
        print(f"[OK] {sql}")
    except Exception as e:
        print(f"[ERR] {sql} : {e}")

print("\nMigration Departement terminée.")
