# scripts/send_existing_employee.py

import sys
import os

# Ajouter le chemin racine au PYTHONPATH pour importer 'backend'
sys.path.append(os.getcwd())

from backend.db import Database
from backend.repositories.employe_repo import EmployeRepository
from backend.repositories.utilisateur_repo import UtilisateurRepository
from backend.utils.email_sender import send_welcome_email

def manual_send():
    db = Database()
    emp_repo = EmployeRepository()
    user_repo = UtilisateurRepository()

    print("--- ENVOI MANUEL DES DÉTAILS DE COMPTE ---")
    
    try:
        emp_id = int(input("Entrez l'ID de l'employé (ex: 54) : "))
        password = input("Entrez le mot de passe (qui a été saisi lors de la création) : ")
    except ValueError:
        print("Erreur : ID invalide.")
        return

    # 1. Récupérer l'employé
    emp = emp_repo.get_by_id(emp_id)
    if not emp:
        print(f"Erreur : Aucun employé trouvé avec l'ID {emp_id}")
        return

    # 2. Récupérer l'utilisateur
    user = user_repo.get_by_employe_id(emp_id)
    if not user:
        print(f"Erreur : Aucun compte utilisateur trouvé pour l'ID {emp_id}")
        return

    # 3. Préparer les données
    personal_email = emp.get("email_personnel")
    pro_email = emp.get("adresse_mail")
    first_name = emp.get("prenom")
    last_name = emp.get("nom")
    role = user.get("role", "EMPLOYEE")

    if not personal_email:
        print("Erreur : Cet employé n'a pas d'email personnel enregistré.")
        return

    print(f"\nPréparation de l'envoi vers {personal_email}...")
    
    # 4. Envoi
    try:
        success = send_welcome_email(
            personal_email, 
            pro_email, 
            password, 
            role, 
            first_name, 
            last_name
        )
        if success:
            print(f"\nSENSÉS ! L'email a été envoyé avec succès à {personal_email}.")
        else:
            print("\nL'envoi a échoué. Vérifiez la configuration SMTP dans le fichier .env.")
    except Exception as e:
        print(f"\nERREUR lors de l'envoi : {e}")

if __name__ == "__main__":
    manual_send()
