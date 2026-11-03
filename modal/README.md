# Modal price loop — deploy notes

`price_loop.py` is the scheduled autonomous worker: every 6 hours it wakes
the deployed Stashov server, which re-polls cooling wishes against their
price floors, clears finished cooling timers, refreshes the digest, and
writes the run into vault telemetry. Inference stays on the server
(Meta Muse, Baseten rescue); Modal is only the clock.

## One-time setup (needs the user's Modal token + Meta deployment URL)

1. `pip install modal`
2. `modal token set --token-id <id> --token-secret <secret>`
   (or `modal token new` and sign in). This is the step that was blocked:
   the user generates the token in the Modal UI.
3. In the Modal UI, open the secret named exactly **`Meta Hackerthon_Stashov`**
   and set:
   - `STASHOV_BASE_URL` = the Meta hackathon deployment URL
     (NOT `stashov.com` — that host is the separate Nebius entry).
   - `STASHOV_ACCESS_TOKEN` = the same token the server runs with.
4. `modal deploy modal/price_loop.py`
5. Optional smoke test: `modal run modal/price_loop.py`

Verify in Modal → Apps → `stashov-price-loop` → Logs: each run prints
wishes polled, cooling cleared, ready count, and top deal alerts.
In Stashov, the same run appears under Router → Live Telemetry and the
Serverless Digest card.
