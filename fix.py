import os

file_path = r"c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\api\routes\stats_api.py"

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Replace the endpoint name
text = text.replace('@router.get("/admin/statistiques")', '@router.get("/admin/dashboard-data")')

# 2. Replace date_pointage BETWEEN with CAST(date_pointage AS DATE) BETWEEN
# For Pointage table usually aliased as p.date_pointage or date_pointage
text = text.replace('p.date_pointage BETWEEN', 'CAST(p.date_pointage AS DATE) BETWEEN')
text = text.replace(' date_pointage BETWEEN', ' CAST(date_pointage AS DATE) BETWEEN')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

# Also fix the frontend API caller
api_file = r"c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\lib\api.ts"
with open(api_file, 'r', encoding='utf-8') as f:
    api_text = f.read()

api_text = api_text.replace('/stats/admin/statistiques', '/stats/admin/dashboard-data')

with open(api_file, 'w', encoding='utf-8') as f:
    f.write(api_text)

print("Fix applied.")
