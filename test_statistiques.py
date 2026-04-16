import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from backend.db import Database
from api.routes.stats_api import get_admin_statistiques

db = Database()
try:
    # Test March 2026
    res = get_admin_statistiques(
        departement_id=None, sous_departement_id=None,
        type_periode="mois", date_str="2026-03",
        date_debut=None, date_fin=None, db=db
    )
    kpi = res["kpi"]
    print("Period:", res["meta"]["periode"].replace("\u2192", "->"))
    print(f"Heures total : {kpi['heures_total']}h")
    print(f"Heures moy/emp/jour : {kpi['heures_moy_employe']}h")
    print(f"Taux retard : {kpi['taux_retard']}%  ({kpi['retards']} retards)")
    print(f"Nb employes : {res['meta']['nb_employes']}")

    # Q1 2026
    res2 = get_admin_statistiques(
        departement_id=None, sous_departement_id=None,
        type_periode="periode", date_str=None,
        date_debut="2026-01-01", date_fin="2026-03-31", db=db
    )
    k2 = res2["kpi"]
    print(f"\nQ1 2026 Heures total : {k2['heures_total']}h")
    print(f"Q1 2026 Heures moy/emp/jour : {k2['heures_moy_employe']}h")
finally:
    db.close()
