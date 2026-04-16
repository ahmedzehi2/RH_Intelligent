from backend.db import Database

db = Database()
try:
    # Check column name
    cols = db.fetch_all("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Pointage'")
    print("Columns:", [c['COLUMN_NAME'] for c in cols])

    # Check heures data
    r = db.fetch_all(
        "SELECT SUM(duree_travail) as h FROM Pointage "
        "WHERE CAST(date_pointage AS DATE) BETWEEN '2026-01-01' AND '2026-03-31'"
    )
    print("Heures 2026 Q1:", r)
    
    # Current month default (April 2026)
    r2 = db.fetch_all(
        "SELECT SUM(duree_travail) as h, COUNT(*) as cnt FROM Pointage "
        "WHERE CAST(date_pointage AS DATE) BETWEEN '2026-04-01' AND '2026-04-30'"
    )
    print("Heures Apr 2026:", r2)
    
    # Check sample
    sample = db.fetch_all(
        "SELECT TOP 3 date_pointage, duree_travail, statut FROM Pointage ORDER BY date_pointage DESC"
    )
    print("Sample:", sample)
finally:
    db.close()
