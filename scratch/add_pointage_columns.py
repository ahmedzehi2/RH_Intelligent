import sys
sys.path.append('.')
from backend.db import Database

db = Database()
columns = db.fetch_all("SELECT name FROM sys.columns WHERE [object_id] = OBJECT_ID('dbo.Pointage')")
existing = [c['name'].lower() for c in columns]

if 'justifiee' not in existing:
    print("Adding justifiee to Pointage")
    db.execute("ALTER TABLE dbo.Pointage ADD justifiee BIT NULL")
if 'date_traitement' not in existing:
    print("Adding date_traitement to Pointage")
    db.execute("ALTER TABLE dbo.Pointage ADD date_traitement DATETIME NULL")
if 'traite_par' not in existing:
    print("Adding traite_par to Pointage")
    db.execute("ALTER TABLE dbo.Pointage ADD traite_par INT NULL")

print("Done checking/updating Pointage schema.")
db.close()
