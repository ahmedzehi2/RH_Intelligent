import os
import requests
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GEMINI_API_KEY")

models = ["gemini-1.5-flash", "gemini-pro"]
endpoints = ["v1", "v1beta"]

for model in models:
    for ep in endpoints:
        url = f"https://generativelanguage.googleapis.com/{ep}/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": "Hello"}]}]
        }
        try:
            resp = requests.post(url, json=payload, timeout=5)
            print(f"Testing {ep} with {model}: {resp.status_code}")
            if resp.status_code == 200:
                print(f"SUCCESS: {url}")
        except Exception as e:
            print(f"ERROR {ep} with {model}: {e}")
