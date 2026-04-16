import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.repositories.utilisateur_repo import UtilisateurRepository
repo = UtilisateurRepository()
user = repo.get_by_username("rami.benali@unilog.tn")
print(user)
