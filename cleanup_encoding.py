"""
Script de nettoyage : Répare les caractères UTF-8 corrompus dans la base de données.
(ex: 'DÃ©lÃ©gation' -> 'Délégation')
"""
from backend.db import Database
db = Database()

# Liste des colonnes NVARCHAR à vérifier
columns = db.fetch_all("""
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE DATA_TYPE = 'nvarchar' 
    AND TABLE_SCHEMA = 'dbo'
""")

# Mappings exhaustifs de corruption UTF-8 -> Unicode
# Ces séquences arrivent quand de l'UTF-8 est interprété comme du Windows-1252/Latin-1
fixes = [
    ('Ã©', 'é'),
    ('Ã¨', 'è'),
    ('Ã ', 'à'),
    ('Ã§', 'ç'),
    ('Ã¹', 'ù'),
    ('Ãª', 'ê'),
    ('Ã®', 'î'),
    ('Ã´', 'ô'),
    ('Ã«', 'ë'),
    ('Ã¯', 'ï'),
    ('Ã»', 'û'),
    ('Ã¢', 'â'),
    ('Ã€', 'À'),
    ('Ã‰', 'É'),
    ('â‚¬', '€'),
    ('Â°', '°'),
]

print(f"Nettoyage de {len(columns)} colonnes...")

total_fixed = 0
for col in columns:
    table = col['TABLE_NAME']
    name  = col['COLUMN_NAME']
    
    for corrupted, fixed in fixes:
        # On utilise une requête SQL directe pour faire le remplacement
        # On ne fait l'UPDATE que si nécessaire pour la performance
        sql = f"""
            UPDATE dbo.{table} 
            SET {name} = REPLACE(CAST({name} AS NVARCHAR(MAX)), ?, ?) 
            WHERE CAST({name} AS NVARCHAR(MAX)) LIKE ?
        """
        try:
            # On utilise les paramètres pour éviter les problèmes d'échappement
            db.execute(sql, [corrupted, fixed, f"%{corrupted}%"])
            total_fixed += 1
        except Exception as e:
            pass

print(f"\nNettoyage terminé. {total_fixed} opérations de remplacement tentées.")
