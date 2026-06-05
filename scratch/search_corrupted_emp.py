from backend.db import Database
db = Database()

# Search for any string containing Ã©
results = db.fetch_all("SELECT nom, prenom, poste FROM Employe WHERE nom LIKE '%Ã%' OR prenom LIKE '%Ã%' OR poste LIKE '%Ã%'")
for r in results:
    print(f"{r['nom']} {r['prenom']} | {r['poste']}")
