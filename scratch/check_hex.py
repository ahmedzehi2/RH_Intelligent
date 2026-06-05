from backend.db import Database
db = Database()

depts = db.fetch_all("SELECT nom_departement FROM Departement")
for d in depts:
    s = d['nom_departement']
    hex_chars = " ".join([f"{ord(c):04x}" for c in s])
    print(f"{s} | {hex_chars}")
