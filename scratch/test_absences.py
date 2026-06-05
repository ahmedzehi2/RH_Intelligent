# scratch/test_absences.py
import sys
import os

# Add root folder to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.absence_service import AbsenceService

def main():
    print("Initializing AbsenceService...")
    svc = AbsenceService()
    
    # 1. Fetch one test absence to manipulate
    print("\n--- Fetching test absence from DB ---")
    row = svc.repo.db.fetch_one(
        "SELECT TOP 1 absence_id, employe_id, date_absence, justification_statut, justifiee FROM dbo.Absence ORDER BY absence_id DESC"
    )
    if not row:
        print("No absences found in DB. Aborting test.")
        return
        
    absence_id = row["absence_id"]
    employe_id = row["employe_id"]
    date_absence = str(row["date_absence"])[:10]
    print(f"Test absence: ID={absence_id}, Employe={employe_id}, Date={date_absence}, JustificationStatut={row['justification_statut']}, Justifiee={row['justifiee']}")
    
    # 2. Test Justification = True
    print(f"\n--- Setting justification to True for absence {absence_id} ---")
    res_just = svc.set_justification(absence_id=absence_id, justifiee=True, admin_id=1, motif="Test motif RH")
    print("Result:", res_just)
    
    # Check absence updated state
    row_after_just = svc.repo.db.fetch_one(
        "SELECT justification_statut, justifiee, motif FROM dbo.Absence WHERE absence_id = ?",
        [absence_id]
    )
    print("Absence after justification:", row_after_just)
    
    # Check pointage updated state
    ptg_after_just = svc.repo.db.fetch_one(
        "SELECT statut, sous_statut FROM dbo.Pointage WHERE employe_id = ? AND CAST(date_pointage AS DATE) = CAST(? AS DATE)",
        [employe_id, date_absence]
    )
    print("Pointage after justification:", ptg_after_just)
    
    # 3. Test Justification = False
    print(f"\n--- Setting justification to False for absence {absence_id} ---")
    res_refuse = svc.set_justification(absence_id=absence_id, justifiee=False, admin_id=1, commentaire_rh="Refus test")
    print("Result:", res_refuse)
    
    # Check absence updated state
    row_after_refuse = svc.repo.db.fetch_one(
        "SELECT justification_statut, justifiee, commentaire_rh FROM dbo.Absence WHERE absence_id = ?",
        [absence_id]
    )
    print("Absence after refusal:", row_after_refuse)
    
    # Check pointage updated state
    ptg_after_refuse = svc.repo.db.fetch_one(
        "SELECT statut, sous_statut FROM dbo.Pointage WHERE employe_id = ? AND CAST(date_pointage AS DATE) = CAST(? AS DATE)",
        [employe_id, date_absence]
    )
    print("Pointage after refusal:", ptg_after_refuse)

if __name__ == "__main__":
    main()
