"""
Verify migration result
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.db import Database

db = Database()
cols = db.fetch_all(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
    "WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Absence' ORDER BY ORDINAL_POSITION"
)
print("Colonnes actuelles dans dbo.Absence:")
for c in cols:
    print(" -", c['COLUMN_NAME'], ":", c['DATA_TYPE'])
