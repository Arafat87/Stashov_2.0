"""
Stashov — Modal scheduled price loop.

Modal is the always-on clock, not the brain: every 6 hours this worker wakes
the deployed Stashov server, which re-polls every cooling wish against its
discounter price floor, clears finished cooling timers, refreshes the digest,
and writes the run into vault telemetry. Model calls stay on the server
(Meta / Baseten cascade); Modal only needs the app URL + access token.

Deploy:
    pip install modal
    modal token set --token-id <id> --token-secret <secret>   # user's token
    # In the Modal UI, confirm the secret exists with EXACTLY this name:
    #   Meta Hackerthon_Stashov
    #   STASHOV_BASE_URL      = https://<meta-deployment-host>   (not stashov.com)
    #   STASHOV_ACCESS_TOKEN  = <same token the server was started with>
    modal deploy modal/price_loop.py

Manual one-off run:
    modal run modal/price_loop.py
"""

import json
import os
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

import modal

app = modal.App("stashov-price-loop")
image = modal.Image.debian_slim(python_version="3.12")
stashov_secret = modal.Secret.from_name("Meta Hackerthon_Stashov")


def _post(base: str, path: str, data: bytes, content_type: str, opener) -> tuple[int, str]:
    req = urllib.request.Request(
        base + path,
        data=data,
        headers={"Content-Type": content_type},
        method="POST",
    )
    try:
        with opener.open(req, timeout=120) as res:
            return res.status, res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8", "replace")


@app.function(image=image, secrets=[stashov_secret], schedule=modal.Cron("0 */6 * * *"), timeout=600)
def price_loop() -> dict:
    base = os.environ.get("STASHOV_BASE_URL", "").strip().rstrip("/")
    token = os.environ.get("STASHOV_ACCESS_TOKEN", "").strip()
    if not base or not token:
        raise RuntimeError("Secret 'Meta Hackerthon_Stashov' must set STASHOV_BASE_URL and STASHOV_ACCESS_TOKEN.")

    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    # The token is exchanged once for the HttpOnly session cookie.
    status, _ = _post(
        base,
        "/unlock",
        urllib.parse.urlencode({"token": token, "next": "/"}).encode(),
        "application/x-www-form-urlencoded",
        opener,
    )
    if status not in (200, 302, 303):
        raise RuntimeError(f"Unlock failed with HTTP {status}; check STASHOV_ACCESS_TOKEN.")

    status, body = _post(base, "/api/serverless-job", b"{}", "application/json", opener)
    if status != 200:
        raise RuntimeError(f"Price loop job failed with HTTP {status}: {body[:300]}")

    report = json.loads(body).get("report", {})
    stats = report.get("stats", {})
    summary = {
        "job_id": report.get("job_id"),
        "wishes_polled": stats.get("wishlist_items_polled"),
        "cooling_cleared": stats.get("cooling_off_cleared"),
        "gate_ready": stats.get("gate_ready"),
        "gate_cooling": stats.get("gate_cooling"),
        "remaining_budget": stats.get("remaining_monthly_budget"),
        "top_deals": report.get("top_deal_alerts", []),
    }
    print(json.dumps(summary, indent=2))
    return summary


@app.local_entrypoint()
def main():
    print(price_loop.remote())
