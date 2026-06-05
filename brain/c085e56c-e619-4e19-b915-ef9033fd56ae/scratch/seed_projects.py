from backend.db import Database
from datetime import datetime, timedelta

db = Database()

# Nettoyage si besoin (optionnel)
# db.execute("DELETE FROM dbo.Tache")
# db.execute("DELETE FROM dbo.Projet")

# Seed Projets
projets = [
    ("Migration ERP Cloud", (datetime.now() + timedelta(days=45)).strftime('%Y-%m-%d'), 'EN_COURS', 65, 6),
    ("Refonte Portail Employé", (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d'), 'EN_COURS', 90, 7),
    ("Système IA Prédictif", (datetime.now() + timedelta(days=120)).strftime('%Y-%m-%d'), 'EN_ATTENTE', 0, 8),
    ("Audit Sécurité Annuel", (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d'), 'EN_COURS', 15, 6)
]

for p in projets:
    db.execute("INSERT INTO dbo.Projet (nom, date_fin, statut, progression, departement_id) VALUES (?, ?, ?, ?, ?)", p)

# Seed Tâches
projet_ids = [r['projet_id'] for r in db.fetch_all("SELECT projet_id FROM dbo.Projet")]
if projet_ids:
    taches = [
        (projet_ids[0], 1, "Configuration Azure", "TERMINE", "Haute"),
        (projet_ids[0], 2, "Migration SQL Server", "EN_COURS", "Critique"),
        (projet_ids[1], 16, "Intégration Lucide Icons", "TERMINE", "Moyenne"),
        (projet_ids[1], 17, "Tests de charge", "EN_COURS", "Haute"),
        (projet_ids[2], 18, "Data Cleaning", "EN_ATTENTE", "Moyenne")
    ]
    for t in taches:
        db.execute("INSERT INTO dbo.Tache (projet_id, employe_id, nom, statut, priorite) VALUES (?, ?, ?, ?, ?)", t)

print("Seed completed successfully!")
db.close()
