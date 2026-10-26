#!/usr/bin/env python3
"""Self-host the page's Latin web fonts so visitors never wait on fonts.googleapis.com.

Chinese text uses the system fonts (PingFang SC / Microsoft YaHei), so only the
small Latin faces are downloaded here.
"""
import hashlib
import os
import re
import sys
import urllib.request

OUT = sys.argv[1]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
URL = ("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800"
       "&family=Geist+Mono:wght@400;500;600&display=swap")


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read()


os.makedirs(OUT, exist_ok=True)
css = get(URL).decode()
count = 0


def local(match):
    global count
    url = match.group(1)
    name = hashlib.sha1(url.encode()).hexdigest()[:16] + ".woff2"
    path = os.path.join(OUT, name)
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(get(url))
    count += 1
    return "url(" + name + ")"


css = re.sub(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", local, css)
with open(os.path.join(OUT, "fonts.css"), "w") as f:
    f.write(css)
print("fonts:", count)
