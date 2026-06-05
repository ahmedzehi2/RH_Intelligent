from backend.db import Database
db = Database()

# Mappings exhaustifs (Unicode)
fixes = {
    '\u00c3\u00a9': 'é',
    '\u00c3\u00a8': 'è',
    '\u00c3\u00a0': 'à',
    '\u00c3\u00a7': 'ç',
    '\u00c3\u00b9': 'ù',
    '\u00c3\u00aa': 'ê',
    '\u00c3\u00ae': 'î',
    '\u00c3\u00b4': 'ô',
    '\u00c3\u00ab': 'ë',
    '\u00c3\u00af': 'ï',
    '\u00c3\u00bb': 'û',
    '\u00c3\u00a2': 'â',
    '\u00c3\u0080': 'À',
    ('\u00c3' + '\u0089'): 'É',
    '\u00e2\u0082\u00ac': '€',
    '\u00c2\u00b0': '°',
}

# Tables et colonnes PK pour pouvoir faire des UPDATE précis
# On va chercher les tables via INFORMATION_SCHEMA
tables = db.fetch_all("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")

for t in tables:
    table = t['TABLE_NAME']
    # Trouver la PK (on suppose que c'est le premier ID ou on cherche)
    pk_info = db.fetch_one(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '{table}'")
    if not pk_info: continue
    pk = pk_info['COLUMN_NAME']
    
    # Trouver les colonnes texte
    cols = db.fetch_all(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}' AND DATA_TYPE IN ('nvarchar', 'varchar', 'ntext', 'text')")
    col_names = [c['COLUMN_NAME'] for c in cols]
    if not col_names: continue
    
    print(f"Checking table {table}...")
    
    # On fetch tout (limité si besoin, mais ici la DB est petite)
    rows = db.fetch_all(f"SELECT {pk}, {', '.join(col_names)} FROM {table}")
    
    for row in rows:
        pk_val = row[pk]
        needs_update = False
        updates = {}
        
        for col in col_names:
            val = row[col]
            if val and isinstance(val, str):
                new_val = val
                for corrupted, fixed in fixes.items():
                    if corrupted in new_val:
                        new_val = new_val.replace(corrupted, fixed)
                
                if new_val != val:
                    needs_update = True
                    updates[col] = new_val
        
        if needs_update:
            print(f"  -> Updating {table} PK={pk_val}")
            set_clause = ", ".join([f"{c} = ?" for c in updates.keys()])
            params = list(updates.values()) + [pk_val]
            db.execute(f"UPDATE {table} SET {set_clause} WHERE {pk} = ?", params)

print("Global cleanup finished.")
