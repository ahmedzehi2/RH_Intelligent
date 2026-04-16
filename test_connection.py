from backend.db import Database

db = Database.get()

rows = db.fetch_all("SELECT TOP 5 * FROM dbo.Employe")
print(rows)