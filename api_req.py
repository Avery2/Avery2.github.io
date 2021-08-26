import requests
import json
import csv
import pandas as pd

request_url = "https://api.github.com/users/Avery2/repos?per_page=999"

print("start request...")
r = requests.get(request_url)
# print(type(r))

print("start processing...")

y = json.loads(r.text)

# print(type(y))
print('='*10)
print(len(y))
print('='*10)
for x in y:
    if x["description"] != None:
        # print(x['name'])
        print(f'    - {x["name"]}')
        pass

print(y[0].keys())

# print(y[0])