import requests

try:
    res = requests.get("http://127.0.0.1:8000/mission/all")
    print(f"Status: {res.status_code}")
    # Search for Delegation in the response
    print(f"Contains Délégation (bytes): {b'D\xc3\xa9l\xc3\xa9gation' in res.content}")
    print(f"Contains Délégation (text): {'Délégation' in res.text}")
except Exception as e:
    print(f"Error: {e}")
