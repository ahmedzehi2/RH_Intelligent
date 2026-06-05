from backend.db import Database
db = Database()

query = """
SELECT
    t.name                          AS table_name,
    c.name                          AS column_name,
    c.system_type_id,
    tp.name                         AS data_type,
    c.max_length,
    CASE
        WHEN tp.name LIKE 'nvar%' THEN '✅ Unicode OK'
        WHEN tp.name LIKE 'var%'  THEN '❌ VARCHAR → risque encodage'
        WHEN tp.name LIKE 'char%' THEN '❌ CHAR → risque encodage'
        ELSE '⚠️ Vérifier'
    END                             AS diagnostic
FROM sys.columns c
JOIN sys.tables  t  ON c.object_id  = t.object_id
JOIN sys.types   tp ON c.user_type_id = tp.user_type_id
WHERE tp.name IN ('varchar', 'char', 'nvarchar', 'nchar')
ORDER BY t.name, c.name;
"""

rows = db.fetch_all(query)
for r in rows:
    if '❌' in r['diagnostic']:
        print(f"{r['table_name']}.{r['column_name']}: {r['data_type']} -> {r['diagnostic']}")
print("Diagnostic SQL terminé.")

