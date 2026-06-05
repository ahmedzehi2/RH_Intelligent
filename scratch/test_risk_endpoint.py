import sys
sys.path.append('.')
from backend.utils.security import verify_password

stored_hash = "$2b$12$UJe.yhJQHS//YcK4O6MDL.GzIoEh/YGFs3aInPwFhoro5X21ZQM9C"
passwords = ["admin", "admin123", "nadia", "khaldi", "123456", "password", "inet", "unilog"]
for p in passwords:
    if verify_password(p, stored_hash):
        print(f"MATCH: {p}")
        break
else:
    print("No match found in common passwords.")
