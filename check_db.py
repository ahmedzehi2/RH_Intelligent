import sys
sys.path.append('.')
from backend.db import Database
db = Database()
rows = db.fetch_all('''SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('Pointage','Employe','Departement','Conge','DemandeDocument','Mission','Formation','Inscription') ORDER BY TABLE_NAME, ORDINAL_POSITION;''')
for r in rows: print(r)
print('---')
rows2 = db.fetch_all('''SELECT statut, sous_statut, COUNT(*) as nb FROM dbo.Pointage GROUP BY statut, sous_statut ORDER BY statut, sous_statut;''')
for r in rows2: print(r)
