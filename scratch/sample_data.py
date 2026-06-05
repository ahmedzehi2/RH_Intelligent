from backend.db import Database
db = Database()

print("\n--- Departements ---")
depts = db.fetch_all("SELECT nom_departement, sous_departement FROM Departement")
for d in depts:
    print(f"{d['nom_departement']} | {d['sous_departement']}")

print("\n--- Employes (Postes) ---")
emps = db.fetch_all("SELECT TOP 10 poste FROM Employe")
for e in emps:
    print(f"{e['poste']}")
