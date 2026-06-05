from backend.db import Database
db = Database()

results = db.fetch_all("SELECT lieu, type_mission, adresse FROM Mission")
for r in results:
    for k, v in r.items():
        if v and 'Ã' in v:
            print(f"STILL FOUND in Mission.{k}: {v}")
        elif v and 'é' in v:
             print(f"FIXED in Mission.{k}: {v}")
