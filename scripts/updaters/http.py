"""Bounded, auditable HTTP for public sources."""
from hashlib import sha256
import time
from urllib.parse import urlsplit

import requests


class SourceUnavailable(Exception):
    pass


class HTTP:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "HealthcareDataLibrary/1.0 (wizardzxx-tech/chart)"})
        self.cache = {}
        self.evidence = []

    def get(self, url, *, params=None, missing=None, limit=12_000_000, headers=None):
        key = (url, str(params))
        if key in self.cache:
            return self.cache[key]
        if urlsplit(url).scheme != "https":
            raise ValueError("Official sources must use HTTPS")
        for attempt in range(3):
            try:
                with self.session.get(url, params=params, timeout=(6, 12), stream=True,
                                      headers=headers, allow_redirects=headers is None) as response:
                    if headers and response.is_redirect:
                        raise SourceUnavailable(f"Redirect in authenticated request · {urlsplit(url).hostname}")
                    if response.status_code == missing:
                        break
                    if response.status_code in (401, 403, 404, 412):
                        raise SourceUnavailable(f"HTTP {response.status_code} · {urlsplit(url).hostname}")
                    response.raise_for_status()
                    if urlsplit(response.url).scheme != "https" or "abuse-detection-apology" in response.url:
                        raise SourceUnavailable(f"Restricted response · {urlsplit(url).hostname}")
                    body = bytearray()
                    for chunk in response.iter_content(65536):
                        body.extend(chunk)
                        if len(body) > limit:
                            raise SourceUnavailable(f"Response over size limit · {urlsplit(url).hostname}")
                    entry = {"url": response.url, "sha256": sha256(body).hexdigest(),
                             "bytes": len(body)}
                    for header, label in (("ETag", "etag"), ("Last-Modified", "last_modified")):
                        if header in response.headers:
                            entry[label] = response.headers[header]
                    self.evidence.append(entry)
                    self.cache[key] = bytes(body)
                    return self.cache[key]
            except requests.RequestException as error:
                if attempt == 2:
                    reason=f"HTTP {error.response.status_code}" if error.response is not None else type(error).__name__
                    raise SourceUnavailable(f"{reason} · {urlsplit(url).hostname}") from None
                retry = error.response.headers.get("Retry-After", "") if error.response is not None else ""
                time.sleep(min(20, int(retry)) if retry.isdigit() else 2 ** attempt)
        return None
