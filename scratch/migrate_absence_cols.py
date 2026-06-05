"""
Migration : ajout des colonnes de justification RH dans dbo.Absence
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import Database

db = Database()

# 1. Vérifier colonnes existantes
cols = db.fetch_all(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
    "WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Absence' ORDER BY ORDINAL_POSITION"
)
existing = {c['COLUMN_NAME'] for c in cols}
print("Colonnes existantes:", existing)

# 2. Ajouter les nouvelles colonnes si elles n'existent pas
migrations = [
    ("justification_statut", "ALTER TABLE dbo.Absence ADD justification_statut NVARCHAR(20) DEFAULT 'EN_ATTENTE'"),
    ("commentaire_rh",       "ALTER TABLE dbo.Absence ADD commentaire_rh NVARCHAR(500) NULL"),
    ("traite_par_admin",     "ALTER TABLE dbo.Absence ADD traite_par_admin INT NULL"),
    ("date_traitement",      "ALTER TABLE dbo.Absence ADD date_traitement DATETIME NULL"),
]

for col_name, sql in migrations:
    if col_name not in existing:
        try:
            db.execute(sql)
            print(f"  ✅ Colonne '{col_name}' ajoutée.")
        except Exception as e:
            print(f"  ❌ Erreur pour '{col_name}': {e}")
    else:
        print(f"  ⏭  Colonne '{col_name}' déjà présente, ignorée.")

# 3. Mettre à jour les absences existantes avec statut EN_ATTENTE
try:
    db.execute(
        "UPDATE dbo.Absence SET justification_statut = 'EN_ATTENTE' "
        "WHERE justification_statut IS NULL AND (statut = 'EN_ATTENTE' OR statut IS NULL)"
    )
    print("  ✅ Absences existantes synchronisées avec justification_statut = 'EN_ATTENTE'.")
except Exception as e:
    print(f"  ❌ Erreur sync: {e}")

print("\nMigration terminée.")
