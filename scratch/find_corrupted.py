from backend.db import Database
db = Database()

# Search for corrupted strings in important columns
tables_cols = {
    "Departement": ["nom_departement", "sous_departement"],
    "Employe": ["nom", "prenom", "poste"],
    "Document": ["type_document", "titre"],
}

for table, cols in tables_cols.items():
    for col in cols:
        print(f"\nChecking {table}.{col}...")
        results = db.fetch_all(f"SELECT {col} FROM {table} WHERE {col} LIKE '%Ã%'")
        for r in results:
            print(f"Found: {r[col]}")
