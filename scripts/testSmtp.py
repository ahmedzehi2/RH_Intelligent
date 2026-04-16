# test_smtp.py

from backend.utils.email_sender import send_welcome_email
import sys

def run_test():
    try:
        print("Test d'envoi SMTP (Simulation si pas de credentials, reel si .env configure)...")
        send_welcome_email(
            personal_email="ton_email_reel@gmail.com",
            pro_email="test.utilisateur@societe.com",
            password="TempPass@123",
            role="Employé",
            first_name="Test",
            last_name="Utilisateur"
        )
        print("OK - Fonction d'envoi terminée sans crash.")
    except Exception as e:
        print(f"ERREUR LORS DU TEST : {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_test()
