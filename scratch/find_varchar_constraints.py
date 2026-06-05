from backend.db import Database
db = Database()

# Trouver les colonnes VARCHAR et leurs éventuelles contraintes/index
query = """
SELECT 
    t.name AS TableName, 
    c.name AS ColumnName, 
    ty.name AS DataType, 
    c.max_length,
    obj.name AS ConstraintName,
    obj.type_desc AS ConstraintType
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
LEFT JOIN sys.index_columns ic ON ic.object_id = t.object_id AND ic.column_id = c.column_id
LEFT JOIN sys.indexes i ON i.object_id = t.object_id AND i.index_id = ic.index_id
LEFT JOIN sys.objects obj ON obj.object_id = i.object_id AND obj.name = i.name
WHERE ty.name = 'varchar'
AND t.is_ms_shipped = 0
"""

results = db.fetch_all(query)
for r in results:
    print(f"Table: {r['TableName']}, Col: {r['ColumnName']}, Type: {r['DataType']}, Len: {r['max_length']}, Constraint: {r['ConstraintName']} ({r['ConstraintType']})")
