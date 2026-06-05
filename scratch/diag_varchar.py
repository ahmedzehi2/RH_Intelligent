from backend.db import Database
db = Database()

query = "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE DATA_TYPE = 'varchar'"
rows = db.fetch_all(query)
for r in rows:
    print(f"{r['TABLE_NAME']}.{r['COLUMN_NAME']}: {r['DATA_TYPE']}")
