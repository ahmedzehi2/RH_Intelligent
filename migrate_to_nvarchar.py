"""
Migration : Conversion de tous les champs VARCHAR en NVARCHAR pour supporter l'Unicode (UTF-8).
"""
from backend.db import Database

db = Database()

# Liste des colonnes à convertir (trouvées via INFORMATION_SCHEMA)
# Note: On garde les mêmes longueurs (ex: VARCHAR(100) -> NVARCHAR(100))
columns_to_fix = db.fetch_all("""
    SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE DATA_TYPE = 'varchar' 
    AND TABLE_SCHEMA = 'dbo'
""")

print(f"Trouvé {len(columns_to_fix)} colonnes à convertir...")

for col in columns_to_fix:
    table = col['TABLE_NAME']
    name  = col['COLUMN_NAME']
    length = col['CHARACTER_MAXIMUM_LENGTH']
    
    # Gérer les longueurs (-1 signifie MAX)
    len_str = "MAX" if length == -1 or length is None else str(length)
    
    sql = f"ALTER TABLE dbo.{table} ALTER COLUMN {name} NVARCHAR({len_str}) NULL"
    
    try:
        db.execute(sql)
        print(f"[OK] {table}.{name} -> NVARCHAR({len_str})")
    except Exception as e:
        print(f"[ERR] {table}.{name} : {e}")

print("\nConversion terminée.")
