import requests
import time
def WebsiteType(url:str):
    try:
        req = requests.get(url=url)
        print(req.status_code)
        print(req.text)
        with open("website.html", "w") as f:
            f.write(req.text)

        
        text_count = len(str(req.text))

        # print("array count: ", req.text)
        # lets take few dynamic websites and compare
        
        # youtube.com
        # array count:  3548
        # word scount  870703
        return text_count
    except:
        return "Wrong url provided , please try again"

s = WebsiteType("https://lashaergeshidze.vercel.app/")
print("word scount " , s)
