import requests

try:
    res = requests.get("http://127.0.0.1:8000/mission/employe/3")
    print(f"Status: {res.status_code}")
    print(f"Body: {res.text[:1000]}")
    # Search for Delegation or Reunion
    print(f"Contains correct 'é' (0xc3 0xa9): {b'\xc3\xa9' in res.content}")
except Exception as e:
    print(f"Error: {e}")
