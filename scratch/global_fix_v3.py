from backend.db import Database
import re

db = Database()

def fix_string(s):
    if not s: return s
    try:
        # Tente de corriger le double encodage UTF-8 -> Latin-1
        # On ne le fait que si la chaîne contient des caractères typiques de corruption (Ã, Â, etc.)
        if any(c in s for c in 'ÃÂÂ©Â®â'):
            # On encode en latin-1 pour retrouver les octets bruts, puis on décode en utf-8
            return s.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    
    # Fallback sur un remplacement manuel pour les cas restants
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
        '\u00c3\u0089': 'É',
        '\u00e2\u0082\u00ac': '€',
        '\u00c2\u00b0': '°',
    }
    new_s = s
    for corrupted, fixed in fixes.items():
        new_s = new_s.replace(corrupted, fixed)
    return new_s

tables = db.fetch_all("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")

for t in tables:
    table = t['TABLE_NAME']
    pk_info = db.fetch_one(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '{table}'")
    if not pk_info: continue
    pk = pk_info['COLUMN_NAME']
    
    cols = db.fetch_all(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}' AND DATA_TYPE IN ('nvarchar', 'varchar', 'ntext', 'text')")
    col_names = [c['COLUMN_NAME'] for c in cols]
    if not col_names: continue
    
    print(f"Processing {table}...")
    rows = db.fetch_all(f"SELECT {pk}, {', '.join(col_names)} FROM {table}")
    
    for row in rows:
        pk_val = row[pk]
        updates = {}
        for col in col_names:
            val = row[col]
            if val and isinstance(val, str):
                fixed_val = fix_string(val)
                if fixed_val != val:
                    updates[col] = fixed_val
        
        if updates:
            print(f"  -> Fix row {pk}={pk_val} in {table}")
            set_clause = ", ".join([f"{c} = ?" for c in updates.keys()])
            db.execute(f"UPDATE {table} SET {set_clause} WHERE {pk} = ?", list(updates.values()) + [pk_val])

print("Finished.")
