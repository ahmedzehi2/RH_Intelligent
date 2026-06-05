import sys
sys.path.append('.')
from backend.db import Database

db = Database()
print("--- Pointage Table Columns ---")
rows_pt = db.fetch_all("SELECT name FROM sys.columns WHERE [object_id] = OBJECT_ID('dbo.Pointage')")
for r in rows_pt:
    print(r['name'])

print("\n--- Absence Table Columns ---")
rows_ab = db.fetch_all("SELECT name FROM sys.columns WHERE [object_id] = OBJECT_ID('dbo.Absence')")
for r in rows_ab:
    print(r['name'])
db.close()
