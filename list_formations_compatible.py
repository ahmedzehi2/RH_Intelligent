#!/usr/bin/env python3
"""
Liste des formations compatibles disponibles dans le système
"""

import sys
from datetime import datetime
from backend.repositories.formation_repo import FormationRepository

def format_date(date_str):
    """Formate une date en chaîne lisible"""
    if not date_str:
        return "N/A"
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return d.strftime("%d-%m-%Y")
    except:
        return date_str

def get_status_badge(date_debut, date_fin):
    """Détermine le statut de la formation"""
    today = datetime.now().date()
    try:
        start = datetime.strptime(date_debut, "%Y-%m-%d").date()
        end = datetime.strptime(date_fin, "%Y-%m-%d").date()
        
        if today < start:
            return "À venir"
        elif today <= end:
            return "En cours"
        else:
            return "Terminée"
    except:
        return "N/A"

def list_formations_by_type():
    """Affiche les formations groupées par type"""
    repo = FormationRepository()
    formations = repo.get_all()
    
    if not formations:
        print("❌ Aucune formation trouvée dans la base de données")
        return
    
    # Grouper par type
    by_type = {}
    for f in formations:
        type_f = f.get("type_formation", "Non spécifié")
        if type_f not in by_type:
            by_type[type_f] = []
        by_type[type_f].append(f)
    
    print("\n" + "="*100)
    print("📚 LISTE DES FORMATIONS COMPATIBLES")
    print("="*100 + "\n")
    
    for type_formation in sorted(by_type.keys()):
        formations_du_type = by_type[type_formation]
        print(f"\n🏷️  TYPE: {type_formation}")
        print("-" * 100)
        
        for f in formations_du_type:
            date_debut = f.get("date_debut", "")
            date_fin = f.get("date_fin", date_debut)
            status = get_status_badge(date_debut, date_fin)
            
            print(f"\n  ID: {f.get('formation_id')}")
            print(f"  ✅ Titre: {f.get('titre', 'N/A')}")
            print(f"  📅 Dates: {format_date(date_debut)} → {format_date(date_fin)}")
            print(f"  🏢 Organisateur: {f.get('organisateur', 'N/A')}")
            print(f"  📍 Lieu: {f.get('lieu', 'N/A')}")
            print(f"  ⏱️  Durée: {f.get('duree', 'N/A')} heures")
            print(f"  👥 Places: {f.get('nombre_places', 'Illimitées')}")
            print(f"  🔔 Statut: {status}")
            print(f"  📝 Description: {f.get('description', 'N/A')}")

def list_formations_by_organizer():
    """Affiche les formations groupées par organisateur"""
    repo = FormationRepository()
    formations = repo.get_all()
    
    if not formations:
        print("❌ Aucune formation trouvée")
        return
    
    # Grouper par organisateur
    by_org = {}
    for f in formations:
        org = f.get("organisateur", "Organisateur inconnu")
        if org not in by_org:
            by_org[org] = []
        by_org[org].append(f)
    
    print("\n" + "="*100)
    print("🏢 FORMATIONS GROUPÉES PAR ORGANISATEUR")
    print("="*100 + "\n")
    
    for org in sorted(by_org.keys()):
        formations_org = by_org[org]
        print(f"\n🏢 Organisateur: {org} ({len(formations_org)} formation(s))")
        print("-" * 100)
        
        for f in formations_org:
            date_debut = f.get("date_debut", "")
            date_fin = f.get("date_fin", date_debut)
            
            print(f"  • {f.get('titre', 'N/A')}")
            print(f"    Dates: {format_date(date_debut)} → {format_date(date_fin)}")
            print(f"    Type: {f.get('type_formation', 'N/A')}")
            print(f"    Durée: {f.get('duree', 'N/A')} heures")

def list_formations_upcoming():
    """Affiche les formations à venir"""
    repo = FormationRepository()
    formations = repo.get_all()
    
    if not formations:
        print("❌ Aucune formation trouvée")
        return
    
    today = datetime.now().date()
    upcoming = []
    
    for f in formations:
        try:
            start = datetime.strptime(f.get("date_debut", ""), "%Y-%m-%d").date()
            if start >= today:
                upcoming.append(f)
        except:
            pass
    
    # Trier par date
    upcoming.sort(key=lambda x: x.get("date_debut", ""))
    
    print("\n" + "="*100)
    print("📌 FORMATIONS À VENIR (prochaines 30 jours)")
    print("="*100 + "\n")
    
    if not upcoming:
        print("Aucune formation à venir")
        return
    
    for f in upcoming:
        date_debut = f.get("date_debut", "")
        date_fin = f.get("date_fin", date_debut)
        places = f.get("nombre_places", "Illimitées")
        
        print(f"\n  📌 {f.get('titre', 'N/A')}")
        print(f"     🗓️  {format_date(date_debut)} → {format_date(date_fin)}")
        print(f"     🏢 {f.get('organisateur', 'N/A')} | 📍 {f.get('lieu', 'N/A')}")
        print(f"     👥 Places: {places} | ⏱️  {f.get('duree', 'N/A')}h | 🏷️  {f.get('type_formation', 'N/A')}")

def get_compatibility_report():
    """Génère un rapport de compatibilité"""
    repo = FormationRepository()
    formations = repo.get_all()
    
    print("\n" + "="*100)
    print("📊 RAPPORT DE COMPATIBILITÉ")
    print("="*100 + "\n")
    
    types = set()
    orgs = set()
    total_places = 0
    
    for f in formations:
        types.add(f.get("type_formation", "Non spécifié"))
        orgs.add(f.get("organisateur", "Inconnu"))
        places = f.get("nombre_places")
        if places:
            try:
                total_places += int(places)
            except:
                pass
    
    print(f"✅ Total formations: {len(formations)}")
    print(f"🏷️  Types de formations: {len(types)}")
    print(f"🏢 Organisateurs: {len(orgs)}")
    print(f"👥 Total places disponibles: {total_places}")
    
    print("\n📋 Types de formations:")
    for t in sorted(types):
        count = len([f for f in formations if f.get("type_formation") == t])
        print(f"   • {t}: {count} formation(s)")
    
    print("\n🏢 Organisateurs:")
    for o in sorted(orgs):
        count = len([f for f in formations if f.get("organisateur") == o])
        print(f"   • {o}: {count} formation(s)")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        if cmd == "type":
            list_formations_by_type()
        elif cmd == "org":
            list_formations_by_organizer()
        elif cmd == "upcoming":
            list_formations_upcoming()
        elif cmd == "report":
            get_compatibility_report()
        else:
            print("Usage: python list_formations_compatible.py [type|org|upcoming|report]")
    else:
        # Par défaut, afficher tout
        list_formations_by_type()
        list_formations_by_organizer()
        list_formations_upcoming()
        get_compatibility_report()
