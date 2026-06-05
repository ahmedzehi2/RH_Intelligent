from backend.db import Database
db = Database()

res = db.fetch_all("SELECT DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS Collation")
print(f"Collation: {res[0]['Collation']}")
