from backend.db import Database
db = Database()

results = db.fetch_all("SELECT type_mission FROM Mission WHERE type_mission LIKE '%union%'")
for r in results:
    s = r['type_mission']
    hex_chars = " ".join([f"{ord(c):04x}" for c in s])
    print(f"'{s}' | {hex_chars}")
