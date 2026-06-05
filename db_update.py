# -*- coding: utf-8 -*-
from backend.db import Database
db = Database()
try:
    try:
        db.execute("ALTER TABLE dbo.Absence ADD etat NVARCHAR(50) DEFAULT 'EN_ATTENTE'")
    except Exception as e:
        print('etat exists?', e)
    try:
        db.execute("ALTER TABLE dbo.Absence ADD sous_statut NVARCHAR(50) DEFAULT 'SANS_POINTAGE'")
    except Exception as e:
        print('sous_statut exists?', e)
    db.execute("UPDATE dbo.Absence SET etat = justification_statut WHERE justification_statut IS NOT NULL")
    db.execute("UPDATE dbo.Absence SET etat = 'JUSTIFIÉE' WHERE etat = 'JUSTIFIEE'")
    db.execute("UPDATE dbo.Absence SET etat = 'NON_JUSTIFIÉE' WHERE etat = 'REFUSEE'")
    db.execute("UPDATE dbo.Absence SET sous_statut = 'SANS_POINTAGE' WHERE sous_statut IS NULL")
    print('DB Altered successfully')
except Exception as e:
    print('Error:', e)
