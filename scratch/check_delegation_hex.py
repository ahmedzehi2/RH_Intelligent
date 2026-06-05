from backend.db import Database
db = Database()

results = db.fetch_all("SELECT TOP 1 lieu FROM Mission WHERE lieu LIKE '%D%l%gation%'")
if results:
    s = results[0]['lieu']
    hex_chars = " ".join([f"{ord(c):04x}" for c in s])
    print(f"'{s}' | {hex_chars}")
