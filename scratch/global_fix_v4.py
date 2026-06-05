from backend.db import Database
db = Database()

def fix_string(s):
    if not s: return s
    try:
        # Detect typical double-encoding markers
        if any(c in s for c in 'ÃÂÂ©Â®â'):
            return s.encode('latin-1').decode('utf-8')
    except:
        pass
    
    fixes = {'\u00c3\u00a9': 'é', '\u00c3\u00a8': 'è', '\u00c3\u00a0': 'à', '\u00c3\u00a7': 'ç', '\u00c3\u00b9': 'ù', '\u00c3\u00aa': 'ê', '\u00c3\u00ae': 'î', '\u00c3\u00b4': 'ô', '\u00c3\u00ab': 'ë', '\u00c3\u00af': 'ï', '\u00c3\u00bb': 'û', '\u00c3\u00a2': 'â'}
    for k, v in fixes.items():
        s = s.replace(k, v)
    return s

# Query to find actual Primary Keys
pk_query = """
SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
"""
pks = {r['TABLE_NAME']: r['COLUMN_NAME'] for r in db.fetch_all(pk_query)}

tables = db.fetch_all("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")

for t in tables:
    table = t['TABLE_NAME']
    pk = pks.get(table)
    if not pk: continue
    
    cols = db.fetch_all(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}' AND DATA_TYPE IN ('nvarchar', 'varchar', 'ntext', 'text')")
    col_names = [c['COLUMN_NAME'] for c in cols]
    if not col_names: continue
    
    print(f"Processing {table} ({pk})...")
    rows = db.fetch_all(f"SELECT {pk}, {', '.join(col_names)} FROM {table}")
    
    for row in rows:
        pk_val = row[pk]
        updates = {}
        for col in col_names:
            val = row[col]
            if val and isinstance(val, str):
                fixed = fix_string(val)
                if fixed != val:
                    updates[col] = fixed
        
        if updates:
            print(f"  -> Fixing {table} ID={pk_val}")
            set_clause = ", ".join([f"{c} = ?" for c in updates.keys()])
            db.execute(f"UPDATE {table} SET {set_clause} WHERE {pk} = ?", list(updates.values()) + [pk_val])

print("Finished.")
