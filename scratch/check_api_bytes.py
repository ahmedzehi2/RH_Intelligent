import requests

try:
    res = requests.get("http://127.0.0.1:8000/departement/all")
    print(f"Status: {res.status_code}")
    print(f"Content-Type: {res.headers.get('Content-Type')}")
    print(f"Bytes: {res.content[:200]}")
except Exception as e:
    print(f"Error: {e}")
