import sys
sys.path.append('.')
from backend.db import Database

db = Database()
columns = db.fetch_all("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Absence'")
for col in columns:
    print(col)
