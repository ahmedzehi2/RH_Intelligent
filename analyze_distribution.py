#!/usr/bin/env python
"""Analyze probability distribution in detail"""
import sys
sys.path.insert(0, '.')

from backend.services.ml_service import absenteisme_model
from backend.repositories.employe_repo import EmployeRepository

emp_repo = EmployeRepository()
all_emps = emp_repo.get_all()
employes = [e for e in all_emps if e.get("statut") == "Actif"]

# Make predictions
predictions = absenteisme_model.predict_batch(employes, "rf")

# Analyze probabilities
probs = [p["rf_probability"] for p in predictions]
confidences = [p["rf_confidence"] for p in predictions]

print("=== PROBABILITY DISTRIBUTION ===")
print(f"Mean: {sum(probs)/len(probs):.1f}%")
print(f"Min: {min(probs):.1f}%")
print(f"Max: {max(probs):.1f}%")
print(f"Median: {sorted(probs)[len(probs)//2]:.1f}%")

print("\n=== CONFIDENCE DISTRIBUTION ===")
faible = sum(1 for c in confidences if c == "faible")
moyenne = sum(1 for c in confidences if c == "moyenne")
elevee = sum(1 for c in confidences if c == "elevee")
print(f"Faible (<0.30): {faible} ({faible*100/len(confidences):.1f}%)")
print(f"Moyenne (0.30-0.60): {moyenne} ({moyenne*100/len(confidences):.1f}%)")
print(f"Élevée (>=0.60): {elevee} ({elevee*100/len(confidences):.1f}%)")

print("\n=== TOP 10 AT-RISK ===")
at_risk = sorted([p for p in predictions if p["rf_confidence"] != "faible"], 
                 key=lambda x: x["rf_probability"], reverse=True)[:10]
for p in at_risk:
    print(f"  {p.get('nom', 'N/A')}: {p['rf_probability']:.1f}% ({p['rf_confidence']})")
