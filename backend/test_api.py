import requests

try:
    response = requests.get("http://127.0.0.1:8000/api/vocabulary/list?q=joy")
    print(response.status_code)
    data = response.json()
    print("Words:", len(data.get("words", [])))
    print("Suggestions:", data.get("suggestions"))
except Exception as e:
    print("Error:", e)
