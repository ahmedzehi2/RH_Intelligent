from backend.db import Database
db = Database()

# Mappings exhaustifs
fixes = [
    ('\u00c3\u00a9', 'é'),
    ('\u00c3\u00a8', 'è'),
    ('\u00c3\u00a0', 'à'),
    ('\u00c3\u00a7', 'ç'),
    ('\u00c3\u00b9', 'ù'),
    ('\u00c3\u00aa', 'ê'),
    ('\u00c3\u00ae', 'î'),
    ('\u00c3\u00b4', 'ô'),
    ('\u00c3\u00ab', 'ë'),
    ('\u00c3\u00af', 'ï'),
    ('\u00c3\u00bb', 'û'),
    ('\u00c3\u00a2', 'â'),
    ('\u00c3\u0080', 'À'),
    ('\u00c3\u0089', 'É'),
    ('\u00e2\u0082\u00ac', '€'),
    ('\u00c2\u00b0', '°'),
]

columns = db.fetch_all("""
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE DATA_TYPE = 'nvarchar' 
    AND TABLE_SCHEMA = 'dbo'
""")

for col in columns:
    table = col['TABLE_NAME']
    name  = col['COLUMN_NAME']
    
    # On cherche les lignes qui ont au moins un des patterns
    for corrupted, fixed in fixes:
        rows = db.fetch_all(f"SELECT {name} FROM {table} WHERE {name} LIKE ?", [f"%{corrupted}%"])
        if rows:
            print(f"Fixing {len(rows)} rows in {table}.{name} for pattern {corrupted} -> {fixed}")
            update_sql = f"UPDATE {table} SET {name} = REPLACE({name}, ?, ?) WHERE {name} LIKE ?"
            db.execute(update_sql, [corrupted, fixed, f"%{corrupted}%"])

print("Done.")
