import requests


req = requests.get("https://x.com/home")

print(req.text)