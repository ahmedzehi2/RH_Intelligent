"""Fix 2: restore join_emp with Departement join, only change the WHERE clause to use IN(ids)."""

file = r"c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\api\routes\stats_api.py"

with open(file, encoding="utf-8") as f:
    text = f.read()

OLD = '''    join_emp = " LEFT JOIN Employe e ON p.employe_id = e.employe_id"
    join_emp_only = ""  # for Employe-only queries, no extra join needed'''

NEW = '''    join_emp = " LEFT JOIN Employe e ON p.employe_id = e.employe_id LEFT JOIN Departement d ON e.departement_id = d.departement_id"
    join_emp_only = " LEFT JOIN Departement d ON e.departement_id = d.departement_id"'''

if OLD in text:
    text = text.replace(OLD, NEW)
    with open(file, "w", encoding="utf-8") as f:
        f.write(text)
    print("OK - joins restored")
else:
    print("NOT FOUND")
    # Show first occurrence of join_emp
    idx = text.find("join_emp")
    print(repr(text[idx:idx+200]))
