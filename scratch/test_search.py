from backend.db import Database
db = Database()

corrupted = '\u00c3\u00a9'
print(f"Searching for hex: {ord(corrupted[0]):04x} {ord(corrupted[1]):04x}")

# Try to find it in Mission
res = db.fetch_all("SELECT type_mission FROM Mission WHERE type_mission LIKE ?", [f"%{corrupted}%"])
print(f"Found with LIKE: {len(res)}")

# Try with CHARINDEX
res = db.fetch_all("SELECT type_mission FROM Mission WHERE CHARINDEX(?, type_mission) > 0", [corrupted])
print(f"Found with CHARINDEX: {len(res)}")
