from backend.db import Database
db = Database()

# On utilise une comparaison binaire pour être sûr de trouver les mauvais octets
sql = "SELECT type_mission FROM Mission WHERE CAST(type_mission AS VARBINARY(MAX)) LIKE %s"
# %Ã©% en UTF-16LE: 0025 00c3 00a9 0025
# Mais en VARBINARY, c'est dépendant de l'endianness.
# On va plutôt utiliser CHARINDEX avec COLLATE
sql = "SELECT type_mission FROM Mission WHERE CHARINDEX(?, type_mission COLLATE Latin1_General_BIN) > 0"
corrupted = '\u00c3\u00a9'
res = db.fetch_all(sql, [corrupted])
print(f"Found with Binary Collation: {len(res)}")
