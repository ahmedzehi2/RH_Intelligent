from backend.db import Database
db = Database()
res = db.fetch_all("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Mission'")
for row in res:
    print(row['COLUMN_NAME'])
