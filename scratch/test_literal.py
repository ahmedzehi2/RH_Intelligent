from backend.db import Database
db = Database()

# Literal SQL search
sql = "SELECT type_mission FROM Mission WHERE type_mission LIKE N'%Ã©%'"
res = db.fetch_all(sql)
print(f"Found with literal SQL: {len(res)}")
if res:
    print(f"Sample: {res[0]['type_mission']}")
