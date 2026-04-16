from backend.repositories.employe_repo import EmployeRepository

repo = EmployeRepository()

rows = repo.get_all()
print("Nombre employes:", len(rows))
print(rows[:2])