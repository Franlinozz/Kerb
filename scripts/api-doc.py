#!/usr/bin/env python3
"""Regenerate docs/API.md: every endpoint with one real response captured from production.
Arrays are cut to their first items and long strings shortened, and the doc says so; nothing is
invented. Usage: python3 scripts/api-doc.py [base-url]"""
import json, sys, urllib.request, urllib.error, datetime

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://api.usekerb.xyz"

def get(path):
    with urllib.request.urlopen(BASE + path, timeout=90) as r:
        return json.loads(r.read())

def trim(o, depth=0):
    if depth >= 5 and isinstance(o, (list, dict)) and o:
        return f"... {len(o)} {'items' if isinstance(o, list) else 'fields'} omitted"
    if isinstance(o, list):
        return [trim(x, depth + 1) for x in o[:2]] + ([f"... {len(o) - 2} more"] if len(o) > 2 else [])
    if isinstance(o, dict):
        return {k: trim(v, depth + 1) for k, v in o.items()}
    if isinstance(o, str) and len(o) > 160:
        return o[:157] + "..."
    return o

board = get("/v1/board")
kox = next(r for r in board["rows"] if r["symbol"] == "KOx")
latest = get("/v1/reports")["reports"][-1]
positions = get("/v1/credit/1952/positions")
pos = positions["positions"][0] if positions["positions"] else None
bundle_hash = kox["carryLTV"].get("inputsHash")

E = [
    ("GET", "/health", "Observation freshness and post counts per chain.", "/health"),
    ("GET", "/v1/board?chain=196", "One row per asset: posted terms with provenance, the fixed LT, market, next transition, Last Call window, KTS version and margins, a 24 h C(1%) spark; plus a summary. Cache 15 s.", "/v1/board?chain=196"),
    ("GET", "/v1/terms/:chain/:asset", "Latest posted terms for one asset (symbol, token address or assetId), with the bundle link.", "/v1/terms/196/KOx"),
    ("GET", "/v1/clock/:chain/:asset?from&to", "The asset's market clock and session segments over a window (max 31 days).", "/v1/clock/196/KOx"),
    ("GET", "/v1/report/:chain/:asset", "The full KTS report recomputed now from observations: depth curve, mark, stress, capacity, margins. Cache 60 s.", "/v1/report/196/KOx"),
    ("GET", "/v1/proof", "Deployments and verification, recent posts, data coverage, pinning, limitations.", "/v1/proof"),
    ("GET", "/v1/params", "The live KTS parameter file.", "/v1/params"),
    ("GET", "/v1/tape?limit=20", "Newest Terms posts across both chains (limit 1 to 100). Cache 15 s.", "/v1/tape?limit=3"),
    ("GET", "/v1/stats", "Headline counts: observation rows, posts by chain, assets, markets, latest Market-Time Report. Cache 60 s.", "/v1/stats"),
    ("GET", "/v1/credit/:chain", "Credit market state: pool, collaterals with their fixed LT and relayed terms, disclaimer.", "/v1/credit/1952"),
    ("GET", "/v1/credit/:chain/demo-clock", "The testnet demo clock as a schedule: phase, state, next Last Call. Cache 5 s.", "/v1/credit/1952/demo-clock"),
    ("GET", "/v1/credit/:chain/positions?state=curable|all", "Every open position found from KerbCredit events, curable first, then by deadline. Cache 30 s.", "/v1/credit/1952/positions"),
    ("GET", "/v1/credit/:chain/position/:user/:assetId", "One position: debt, LTV, health against the fixed LT, covenant status.",
        f"/v1/credit/1952/position/{pos['user']}/{pos['assetId']}" if pos else None),
    ("GET", "/v1/market-time", "Published Market-Time Reports.", "/v1/market-time"),
    ("GET", "/v1/market-time/:id", "One Market-Time Report.", "/v1/market-time/1"),
    ("GET", "/v1/reports", "Stored KTS report ids.", "/v1/reports"),
    ("GET", "/v1/reports/:id", "One stored KTS report.", f"/v1/reports/{latest}"),
    ("GET", "/v1/bundle/:hash", "The exact input bundle posted under an inputsHash (or a report id). keccak256 of the bytes equals the hash.", f"/v1/bundle/{bundle_hash}" if bundle_hash else None),
    ("GET", "/v1/terms/:chain/:asset/why", "Why the current terms are what they are (V3-04): three sentences with their numbers, computed from the latest post's own input bundle. Chain 196. Cached by inputsHash.", "/v1/terms/196/KOx/why"),
    ("GET", "/v1/terms/:chain/:asset/changes?hours=72", "Every material term change in the window (1 to 168 hours), newest first, each with its computed causes and the post that made it (V3-04). Cache 30 s.", "/v1/terms/196/KOx/changes?hours=72"),
    ("GET", "/v1/credit/:chain/keeper", "The demo keeper's status line (V3-02): its address, the demo state, its position, the last action with its transaction, and what it does next. Read-only. Testnet 1952.", "/v1/credit/1952/keeper"),
    ("GET", "/v1/agents/stats", "Kerb for Agents (V3-03): settled x402 calls by network with the latest settlement, the OKX.AI listing status, and the endpoints. Cache 15 s.", "/v1/agents/stats"),
    ("GET", "/agents/terms/:asset", "Kerb for Agents, free: the latest posted terms for one asset with the why sentences. Served by kerb-agents.", "/agents/terms/HKEXCx"),
]

now = datetime.datetime.now(datetime.timezone.utc).strftime("%d %b %Y %H:%M UTC")
out = [
    "# Kerb API",
    "",
    f"Base URL `{BASE}`. Read-only, JSON, CORS open for GET. Every number carries a provenance label: Verified, Observed, Attested or Computed. A chain or source that does not answer returns a labelled error (502 with `label: \"Unavailable\"`), never a stack trace.",
    "",
    f"Examples below were captured from production on {now} by `scripts/api-doc.py`. Arrays are cut to their first two items and long strings shortened; nothing is invented.",
    "",
    "| Method | Path | What |",
    "|---|---|---|",
]
for m, p, what, _ in E:
    out.append(f"| {m} | `{p.replace('|', chr(92) + '|')}` | {what} |")
for m, p, what, sample in E:
    out += ["", f"## `{m} {p}`", "", what, ""]
    if not sample:
        out += ["No live example available at capture time.", ""]
        continue
    out += [f"`{sample}`", "", "```json", json.dumps(trim(get(sample)), indent=1), "```"]
# The paid endpoints answer only after an x402 payment, so their 402 challenge is captured here instead.
req = urllib.request.Request(BASE + "/agents/credit-check", method="POST")
try:
    urllib.request.urlopen(req, timeout=30)
    challenge = None
except urllib.error.HTTPError as e:
    import base64
    h = e.headers.get("payment-required")
    challenge = json.loads(base64.b64decode(h)) if h else None
out += ["", "## Kerb for Agents: paid checks over x402 (V3-03)", "",
    "`GET` or `POST /agents/credit-check` (asset, amount, unit token|usdg, mode carry|session_max) and `/agents/exit-check` (asset, sizeUSDG) are priced at $0.01 in USDT0 on X Layer and settled through the OKX facilitator. Bad input is a 400 or 404 before any payment is asked for; a 4xx or 5xx is never settled. The answer carries the posted tx, the inputsHash and the command that recomputes it. No model is in the path. Free MCP tools (kerb_terms, kerb_board, kerb_clock, kerb_why, kerb_position, kerb_paid_tools) are at `POST /mcp`, 60 calls a minute per address.", "",
    "`curl -i -X POST " + BASE + "/agents/credit-check` answers 402 with this `PAYMENT-REQUIRED` header, decoded:", "", "```json", json.dumps(challenge, indent=1), "```"]
open("docs/API.md", "w").write("\n".join(out) + "\n")
print("wrote docs/API.md")

# The web Developers page renders the endpoint table from this file, so the two never drift.
with open("apps/web/src/lib/endpoints.json", "w") as f:
    json.dump([{"method": m, "path": p, "what": w} for m, p, w, _ in E], f, indent=1)
    f.write("\n")
