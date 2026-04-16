import sys
sys.path.insert(0, '.')
from backend.db import Database
import traceback

db = Database()

try:
    rows = db.fetch_all('SELECT departement_id, nom_departement FROM Departement ORDER BY nom_departement')
    print(f'Departments: {len(rows)}')

    if rows:
        did = rows[0]['departement_id']
        nom = rows[0]['nom_departement']
        print(f'Testing dept: {nom} (id={did})')

        # Test employee fetch
        emps = db.fetch_all('SELECT employe_id FROM Employe e WHERE e.departement_id = ?', [did])
        print(f'Employees in dept: {len(emps)}')

        # Test sous-dept
        sous = db.fetch_all(
            "SELECT ISNULL(sous_departement, 'General') as sous_dept, COUNT(*) as nb_emp FROM Employe e WHERE e.departement_id = ? GROUP BY sous_departement ORDER BY sous_departement",
            [did]
        )
        print(f'Sous-depts: {sous}')

        print('\nAll endpoints seem OK!')

except Exception as e:
    print('ERROR:', e)
    traceback.print_exc()

finally:
    db.close()
