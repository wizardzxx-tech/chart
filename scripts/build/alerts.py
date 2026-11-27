"""Maintain at most one open issue per recurring dataset incident."""
from hashlib import sha256
import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen

base = f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/issues"
headers = {"Authorization": "Bearer " + os.environ["GH_TOKEN"],
           "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


def api(method, path="", value=None):
    encoded = json.dumps(value).encode() if value is not None else None
    request = Request(base + path, data=encoded, headers=headers, method=method)
    with urlopen(request, timeout=15) as response:
        return json.load(response)


incidents = json.loads(os.environ["INCIDENTS"])
issues = []
for page in range(1, 21):
    chunk = api("GET", "?" + urlencode({"state": "open", "per_page": 100, "page": page}))
    issues.extend(i for i in chunk if "pull_request" not in i)
    if len(chunk) < 100:
        break
else:
    raise RuntimeError("Too many existing issues to reconcile without duplicates")
for incident in incidents:
    key = sha256(incident["dataset"].encode()).hexdigest()[:16]
    marker = f"<!-- chart-data-{key} -->"
    title = f"数据更新 · {incident['dataset']}"
    detail = incident["detail"].replace("<", "&lt;").replace(">", "&gt;")
    body = f"{marker}\n\n**{incident['status']}**\n\n{detail}\n\n[更新中心](https://wizardzxx-tech.github.io/chart/v2/update-center/)\n"
    previous = next((issue for issue in issues if marker in (issue["body"] or "")), None)
    if not previous:
        api("POST", value={"title": title, "body": body})
    elif previous["body"] != body:
        api("PATCH", f"/{previous['number']}", {"body": body})
