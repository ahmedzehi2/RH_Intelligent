#!/usr/bin/env python3
"""
Export des formations compatibles en CSV et JSON
"""

import csv
import json
from datetime import datetime
from backend.repositories.formation_repo import FormationRepository

def export_to_csv():
    """Exporte les formations en CSV"""
    repo = FormationRepository()
    formations = repo.get_all()
    
    if not formations:
        print("Aucune formation à exporter")
        return
    
    # Fichier CSV
    filename = "formations_compatibles.csv"
    
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'ID', 'Titre', 'Type', 'Organisateur', 'Lieu', 
            'Date début', 'Date fin', 'Durée (h)', 'Places', 'Statut'
        ])
        writer.writeheader()
        
        for formation in formations:
            date_debut = formation.get('date_debut', '')
            date_fin = formation.get('date_fin', date_debut)
            
            # Déterminer le statut
            today = datetime.now().date()
            try:
                start = datetime.strptime(date_debut, "%Y-%m-%d").date()
                end = datetime.strptime(date_fin, "%Y-%m-%d").date()
                if today < start:
                    status = "À venir"
                elif today <= end:
                    status = "En cours"
                else:
                    status = "Terminée"
            except:
                status = "N/A"
            
            # Formater les dates
            try:
                d_debut = datetime.strptime(date_debut, "%Y-%m-%d").strftime("%d/%m/%Y")
                d_fin = datetime.strptime(date_fin, "%Y-%m-%d").strftime("%d/%m/%Y")
            except:
                d_debut = date_debut
                d_fin = date_fin
            
            writer.writerow({
                'ID': formation.get('formation_id'),
                'Titre': formation.get('titre', ''),
                'Type': formation.get('type_formation', ''),
                'Organisateur': formation.get('organisateur', ''),
                'Lieu': formation.get('lieu', ''),
                'Date début': d_debut,
                'Date fin': d_fin,
                'Durée (h)': formation.get('duree', ''),
                'Places': formation.get('nombre_places', ''),
                'Statut': status
            })
    
    print(f"✅ Export CSV: {filename}")

def export_to_json():
    """Exporte les formations en JSON"""
    repo = FormationRepository()
    formations = repo.get_all()
    
    filename = "formations_compatibles.json"
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(formations, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Export JSON: {filename}")

def export_statistics():
    """Exporte les statistiques en JSON"""
    repo = FormationRepository()
    formations = repo.get_all()
    
    types = {}
    orgs = {}
    total_places = 0
    
    for f in formations:
        type_f = f.get('type_formation', 'Non spécifié')
        org = f.get('organisateur', 'Inconnu')
        
        if type_f not in types:
            types[type_f] = 0
        types[type_f] += 1
        
        if org not in orgs:
            orgs[org] = 0
        orgs[org] += 1
        
        places = f.get('nombre_places')
        if places:
            try:
                total_places += int(places)
            except:
                pass
    
    stats = {
        'total_formations': len(formations),
        'types_count': len(types),
        'organisateurs_count': len(orgs),
        'total_places': total_places,
        'formations_par_type': types,
        'formations_par_organisateur': orgs,
        'date_export': datetime.now().isoformat()
    }
    
    filename = "formations_stats.json"
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Export statistiques: {filename}")

if __name__ == "__main__":
    print("🚀 Export des formations compatibles...\n")
    export_to_csv()
    export_to_json()
    export_statistics()
    print("\n✅ Tous les fichiers ont été générés avec succès!")
