# diagnostic_env.py
import os
from dotenv import load_dotenv

load_dotenv()

user = os.getenv("SMTP_USER")
host = os.getenv("SMTP_HOST")
port = os.getenv("SMTP_PORT")

print(f"--- DIAGNOSTIC ---")
print(f"SMTP_USER: {user}")
print(f"SMTP_HOST: {host}")
print(f"SMTP_PORT: {port}")
print(f"PASS_LENGTH: {len(os.getenv('SMTP_PASS', ''))}")
print(f"------------------")
